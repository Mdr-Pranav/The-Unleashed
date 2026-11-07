// GET /api/series — every story in Blob storage, with its panels in reading order.
// Public and cached for a few minutes. The studio adds ?fresh=1 plus the password to skip the cache.
import { list } from '@vercel/blob';
import { SLUG, isAdmin, send } from './_lib.js';

// series/story-01/p-1762500000000-003-1600x2400.jpg
const PANEL = /^series\/((?:story|scroll)-\d{2})\/p-(\d{13}-\d{3})-(\d+)x(\d+)\.jpg$/;
const META = /^series\/((?:story|scroll)-\d{2})\/meta\.json$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  const fresh = 'fresh' in (req.query || {});
  if (fresh && !isAdmin(req)) return send(res, 401, { error: 'Wrong password' });

  try {
    const blobs = [];
    let cursor;
    do {
      const page = await list({ prefix: 'series/', cursor, limit: 1000 });
      blobs.push(...page.blobs);
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    const stories = new Map();
    const story = (slug) => {
      if (!stories.has(slug)) {
        const [, kind, num] = slug.match(SLUG);
        stories.set(slug, { slug, kind, number: +num, title: '', blurb: '', panels: [], updatedAt: null, meta: null });
      }
      return stories.get(slug);
    };

    for (const b of blobs) {
      let m;
      if ((m = b.pathname.match(PANEL))) {
        const s = story(m[1]);
        s.panels.push({ url: b.url, order: m[2], w: +m[3], h: +m[4] });
        const t = new Date(b.uploadedAt).toISOString();
        if (!s.updatedAt || t > s.updatedAt) s.updatedAt = t;
      } else if ((m = b.pathname.match(META))) {
        story(m[1]).meta = b;
      }
    }

    // titles and blurbs; the version query skips any stale cached copy after an edit
    await Promise.all(
      [...stories.values()].map(async (s) => {
        if (!s.meta) return;
        try {
          const r = await fetch(`${s.meta.url}?v=${new Date(s.meta.uploadedAt).getTime()}`);
          if (r.ok) {
            const meta = await r.json();
            s.title = String(meta.title || '');
            s.blurb = String(meta.blurb || '');
          }
        } catch {}
      })
    );

    const out = [...stories.values()]
      .map(({ meta, ...s }) => {
        s.panels.sort((a, b) => a.order.localeCompare(b.order));
        return s;
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.number - b.number);

    return send(
      res,
      200,
      { stories: out },
      fresh ? 'no-store' : 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
    );
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: 'Could not read the series' });
  }
}
