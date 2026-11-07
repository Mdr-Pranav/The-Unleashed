/* Oddly Us — live stories from /api/series (Vercel Blob).
   series.html: a story with panels turns its "Coming soon" card into a cover that opens it.
   story.html?s=story-01: shows that story's panels in order.
   If the request fails (or the page is opened as a file), the pages stay as written. */

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const label = (s) => `${s.kind === 'scroll' ? 'Scroll' : 'Story'} ${String(s.number).padStart(2, '0')}`;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  async function load() {
    const r = await fetch('/api/series', { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`series ${r.status}`);
    return (await r.json()).stories || [];
  }

  /* ---------- series.html: cards ---------- */
  function card(s) {
    const li = el('li', `story live${s.kind === 'scroll' ? ' scroll' : ''}`);
    const a = el('a', 'story-link');
    a.href = `story.html?s=${encodeURIComponent(s.slug)}`;

    const first = s.panels[0];
    const img = new Image(first.w, first.h);
    img.className = 'story-img';
    img.src = first.url;
    img.alt = '';
    img.loading = 'lazy';

    const text = el('div', 'story-label');
    text.append(el('p', 'story-num', label(s)));
    if (s.title) text.append(el('p', 'story-title', s.title));
    const meta = el('p', 'story-meta', `${s.panels.length} ${s.panels.length === 1 ? 'panel' : 'panels'}`);
    if (s.updatedAt && Date.now() - new Date(s.updatedAt) < WEEK) {
      meta.append(' · ', el('span', 'new', 'New this week'));
    }
    text.append(meta);

    a.setAttribute('aria-label', `${label(s)}${s.title ? `: ${s.title}` : ''}, ${meta.textContent}`);
    a.append(img, text);
    li.append(a);
    return li;
  }

  async function seriesPage() {
    const lists = { story: $('.stories:not(.scrolls)'), scroll: $('.stories.scrolls') };
    const stories = (await load()).filter((s) => s.panels.length);
    stories.forEach((s) => {
      const list = lists[s.kind];
      if (!list) return;
      const slot = list.children[s.number - 1];
      const live = card(s);
      // a cover that won't load (e.g. a page deleted moments ago) puts the "Coming soon" card back
      $('.story-img', live).addEventListener('error', () => (slot ? live.replaceWith(slot) : live.remove()), { once: true });
      if (slot) slot.replaceWith(live);
      else list.append(live);
    });
  }

  /* ---------- story.html: the reader ---------- */
  async function storyPage(slug) {
    const title = $('#r-title');
    const holder = $('#r-panels');
    let s;
    try {
      s = (await load()).find((x) => x.slug === slug);
    } catch {
      title.textContent = 'Could not load this story';
      $('#r-blurb').textContent = 'Please try again in a moment.';
      return;
    }
    if (!s || !s.panels.length) {
      title.textContent = 'Not out yet';
      $('#r-blurb').textContent = 'This story has no pages yet. Follow on Instagram to hear when it starts.';
      return;
    }

    const name = s.title || label(s);
    document.title = `${name} — Oddly Us — The Unleashed`;
    $('#r-num').textContent = label(s);
    title.textContent = name;
    $('#r-blurb').textContent = s.blurb;
    $('#r-blurb').hidden = !s.blurb;
    $('.reader').classList.add(s.kind);

    s.panels.forEach((p, i) => {
      const img = new Image(p.w, p.h);
      img.src = p.url;
      img.alt = `${name}, ${s.kind === 'scroll' ? 'part' : 'page'} ${i + 1} of ${s.panels.length}`;
      img.loading = i < 2 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => img.remove(), { once: true }); // a page deleted moments ago
      holder.append(img);
    });
    const end = el('p', 'reader-end', s.updatedAt && Date.now() - new Date(s.updatedAt) < WEEK
      ? 'New pages this week. More next week.'
      : 'To be continued.');
    holder.append(end);
  }

  const slug = new URLSearchParams(location.search).get('s');
  if ($('#r-panels')) storyPage(slug || '');
  else if ($('.stories')) seriesPage().catch(() => {}); // keep the placeholders
})();
