// POST /api/studio?action=… — the only way to change the series. Every call needs the studio password.
//   action=check                                   → 200 if the password is right
//   action=upload&story=story-01&order=…&w=…&h=…   → body: one JPEG panel (already resized in the browser)
//   action=meta&story=story-01                     → body: {"title": "...", "blurb": "..."}
//   action=delete                                  → body: {"url": "<panel url>"}
import { put, del } from '@vercel/blob';
import { SLUG, isAdmin, send, readBody, explain } from './_lib.js';

const MAX_PANEL = 4 * 1024 * 1024; // Vercel functions accept up to 4.5 MB per request

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!process.env.STUDIO_PASSWORD) return send(res, 500, { error: 'STUDIO_PASSWORD is not set in Vercel' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Wrong password' });

  const q = req.query || {};
  try {
    switch (q.action) {
      case 'check':
        return send(res, 200, { ok: true });

      case 'upload': {
        if (!SLUG.test(q.story || '')) return send(res, 400, { error: 'Unknown story' });
        if (!/^\d{13}-\d{3}$/.test(q.order || '')) return send(res, 400, { error: 'Bad order' });
        const w = parseInt(q.w, 10);
        const h = parseInt(q.h, 10);
        if (!(w > 0 && w <= 4000 && h > 0 && h <= 20000)) return send(res, 400, { error: 'Bad size' });

        const body = await readBody(req, MAX_PANEL);
        const isJpeg = body.length > 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;
        if (!isJpeg) return send(res, 400, { error: 'Panels must be JPEG' });

        const blob = await put(`series/${q.story}/p-${q.order}-${w}x${h}.jpg`, body, {
          access: 'public',
          contentType: 'image/jpeg',
          cacheControlMaxAge: 31536000, // a panel never changes; a new upload gets a new name
        });
        return send(res, 200, { url: blob.url });
      }

      case 'meta': {
        if (!SLUG.test(q.story || '')) return send(res, 400, { error: 'Unknown story' });
        const data = JSON.parse((await readBody(req, 20000)).toString('utf8') || '{}');
        const meta = {
          title: String(data.title || '').slice(0, 120),
          blurb: String(data.blurb || '').slice(0, 600),
        };
        await put(`series/${q.story}/meta.json`, JSON.stringify(meta), {
          access: 'public',
          contentType: 'application/json',
          allowOverwrite: true,
          cacheControlMaxAge: 60,
        });
        return send(res, 200, meta);
      }

      case 'delete': {
        const { url } = JSON.parse((await readBody(req, 4000)).toString('utf8') || '{}');
        let u;
        try { u = new URL(url); } catch { return send(res, 400, { error: 'Bad url' }); }
        const ours = u.hostname.endsWith('.blob.vercel-storage.com') && /^\/series\/(story|scroll)-\d{2}\/p-[\w-]+\.jpg$/.test(u.pathname);
        if (!ours) return send(res, 400, { error: 'Only series panels can be deleted' });
        await del(url);
        return send(res, 200, { ok: true });
      }

      default:
        return send(res, 400, { error: 'Unknown action' });
    }
  } catch (err) {
    console.error(err);
    // only reached with the right password, so the real reason is safe to show
    return send(res, err.status || 500, { error: err.status ? err.message : explain(err) });
  }
}
