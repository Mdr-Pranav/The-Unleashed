/* The Unleashed — portfolio behaviour.
   Everything here is an enhancement: without script the page reads top to bottom,
   and the index links straight to each large image. */

(() => {
  const root = document.documentElement;
  const still = root.classList.contains('still');
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- the archive, read from the markup ---------- */
  const items = $$('#sheet li').map((li) => ({
    li,
    id: li.dataset.id,
    cat: li.dataset.cat,
    title: $('span', li).textContent,
    src: li.dataset.src,
    medium: li.dataset.medium,
    note: li.dataset.note || '',
    yt: li.dataset.yt || '',
    ig: li.dataset.ig || '',
    large: $('a', li).getAttribute('href'),
    alt: $('img', li).getAttribute('alt'),
    w: +li.dataset.w,
    h: +li.dataset.h,
  }));
  const byId = Object.fromEntries(items.map((it) => [it.id, it]));

  /* ---------- bar: mobile menu and current section ---------- */
  const bar = $('.bar');
  const toggle = $('.menu-toggle');
  toggle.addEventListener('click', () => {
    const open = bar.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Close' : 'Menu';
  });
  $$('.nav a').forEach((a) =>
    a.addEventListener('click', () => {
      bar.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Menu';
    })
  );

  const navLinks = $$('.nav a');
  const sections = navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean);
  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + e.target.id)));
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((s) => navObserver.observe(s));

  /* ---------- entrances: heading, then text, then pictures ---------- */
  if (!still && 'IntersectionObserver' in window) {
    root.classList.add('rise');
    const groups = new Map();
    $$('[data-rise]').forEach((el) => {
      const parent = el.closest('section, footer') || document.body;
      const n = groups.get(parent) || 0;
      el.style.setProperty('--d', Math.min(n, 5) * 80 + 'ms');
      groups.set(parent, n + 1);
    });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0 }
    );
    $$('[data-rise]').forEach((el) => io.observe(el));
  } else {
    $$('[data-rise]').forEach((el) => el.classList.add('in'));
  }

  /* ---------- portraits & sketchbook: tabs ---------- */
  const studio = $('.studio');
  const tabs = $$('[role="tab"]', studio);
  const panels = tabs.map((t) => $('#' + t.getAttribute('aria-controls')));
  studio.classList.add('tabbed');

  function selectTab(tab, focus) {
    tabs.forEach((t, i) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on) panels[i].removeAttribute('data-off');
      else panels[i].setAttribute('data-off', '');
      panels[i].inert = !on;
    });
    if (focus) tab.focus();
    runSketch();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      selectTab(tabs[(keys[e.key] + tabs.length) % tabs.length], true);
    });
  });

  /* ---------- sketchbook: one frame, its pages change ---------- */
  const sketchImgs = $$('.sketch-stack img');
  const sketchBtns = $$('[data-sketch]');
  const sketchCap = $('.sketch-cap');
  const sketchPanel = $('#panel-sketch');
  const sketchCaps = [
    'Hanuman, graphite on paper',
    'Joker, graphite on paper',
    'Pennywise, pencil and colour on paper',
    'Peacock, ink on paper',
  ];
  let sketchAt = 0;
  let sketchTimer = null;
  let sketchVisible = false;

  function showSketch(i) {
    sketchAt = (i + sketchImgs.length) % sketchImgs.length;
    sketchImgs.forEach((img, n) => img.classList.toggle('on', n === sketchAt));
    sketchBtns.forEach((b, n) => b.setAttribute('aria-pressed', String(n === sketchAt)));
    sketchCap.textContent = sketchCaps[sketchAt];
  }
  function runSketch() {
    clearInterval(sketchTimer);
    if (still || !sketchVisible || sketchPanel.hasAttribute('data-off')) return;
    sketchTimer = setInterval(() => showSketch(sketchAt + 1), 3200);
  }
  sketchBtns.forEach((b) =>
    b.addEventListener('click', () => {
      showSketch(+b.dataset.sketch);
      runSketch();
    })
  );
  $('.sketch-stack').addEventListener('click', () => {
    showSketch(sketchAt + 1);
    runSketch();
  });
  new IntersectionObserver((entries) => {
    sketchVisible = entries[0].isIntersecting;
    runSketch();
  }).observe(studio);

  selectTab(tabs[0]);

  /* ---------- all work: filter ---------- */
  const filterBtns = $$('[data-filter]');
  filterBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let n = 0;
      items.forEach((it) => {
        const show = f === 'all' || it.cat === f;
        it.li.hidden = !show;
        it.li.classList.remove('enter');
        if (show && !still) {
          void it.li.offsetWidth; // restart the entrance
          it.li.style.setProperty('--i', n++);
          it.li.classList.add('enter');
        }
      });
    })
  );

  /* ---------- viewer ---------- */
  const viewer = $('#viewer');
  const vMedia = $('#viewer-media');
  const vTitle = $('#viewer-title');
  const vMeta = $('#viewer-meta');
  const vNote = $('#viewer-note');
  const vVideo = $('#viewer-video');
  const vIg = $('#viewer-ig');
  let list = items;
  let at = 0;

  function visibleList() {
    const shown = items.filter((it) => !it.li.hidden);
    return shown.length ? shown : items;
  }

  function render(withVideo) {
    const it = list[at];
    vTitle.textContent = it.title;
    vMeta.textContent = `${it.src} · ${it.medium}`;
    vNote.textContent = it.note;
    vNote.hidden = !it.note; // only shown when a piece has its own line
    vMedia.replaceChildren();
    if (withVideo && it.yt) {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${it.yt}?autoplay=1&rel=0&playsinline=1`;
      f.title = `${it.title}, being drawn`;
      f.allow = 'autoplay; encrypted-media; picture-in-picture';
      f.allowFullscreen = true;
      vMedia.append(f);
      vVideo.textContent = 'Show the finished piece';
    } else {
      const img = new Image(it.w, it.h);
      img.src = it.large;
      img.alt = it.alt;
      vMedia.append(img);
      vVideo.textContent = 'Watch it being drawn';
    }
    vVideo.hidden = !it.yt;
    vVideo.dataset.mode = withVideo && it.yt ? 'video' : 'still';
    vIg.hidden = !it.ig;
    if (it.ig) vIg.href = it.ig;
  }

  let lastFocus = null;
  let closeTimer = 0;

  function openViewer(id, withVideo = false) {
    list = byId[id] && !byId[id].li.hidden ? visibleList() : items;
    at = Math.max(0, list.findIndex((it) => it.id === id));
    render(withVideo);
    clearTimeout(closeTimer);
    if (!viewer.open) {
      lastFocus = document.activeElement;
      viewer.showModal();
      document.body.classList.add('viewer-open');
      requestAnimationFrame(() => viewer.classList.add('active')); // fade in, card springs up
    } else {
      viewer.classList.add('active');
    }
    $('#viewer-close').focus({ preventScroll: true });
  }
  function closeViewer() {
    if (!viewer.open || !viewer.classList.contains('active')) return;
    viewer.classList.remove('active');
    closeTimer = setTimeout(() => {
      viewer.close();
      vMedia.replaceChildren(); // stops a playing video
      document.body.classList.remove('viewer-open');
      if (lastFocus) lastFocus.focus({ preventScroll: true });
    }, still ? 0 : 300);
  }
  function step(d) {
    at = (at + d + list.length) % list.length;
    render(false);
  }

  if (typeof viewer.showModal === 'function') {
    $$('#sheet a').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openViewer(a.closest('li').dataset.id);
      })
    );
    $$('[data-open]').forEach((b) =>
      b.addEventListener('click', () => openViewer(b.dataset.open, !!b.dataset.video))
    );
    vVideo.addEventListener('click', () => render(vVideo.dataset.mode !== 'video'));
    $('#viewer-close').addEventListener('click', closeViewer);
    viewer.addEventListener('click', (e) => {
      if (e.target === viewer) closeViewer(); // a click outside the card
    });
    viewer.addEventListener('cancel', (e) => {
      e.preventDefault(); // Esc: close with the fade instead of instantly
      closeViewer();
    });
    viewer.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    });
  } else {
    // very old browsers: buttons fall back to the large image
    $$('[data-open]').forEach((b) =>
      b.addEventListener('click', () => (window.location.href = byId[b.dataset.open].large))
    );
  }

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
