/* Studio: upload Oddly Us pages to Vercel Blob through /api/studio. */
(() => {
  const $ = (s) => document.querySelector(s);
  const KEY = 'unleashed-studio';
  const MAX_BYTES = 3.9 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
  const SIZES = { story: { w: 1600, h: 2400 }, scroll: { w: 1200, h: 12000 } };

  let password = '';
  try { password = sessionStorage.getItem(KEY) || ''; } catch {}
  let stories = [];
  let picked = [];

  const slug = () => `${$('#kind').value}-${$('#number').value}`;
  const current = () => stories.find((s) => s.slug === slug());

  function status(id, text, kind = '') {
    const p = $(id);
    p.textContent = text;
    p.className = `st-status ${kind}`;
  }

  async function api(action, params = {}, body, type = 'application/json') {
    const qs = new URLSearchParams({ action, ...params });
    const r = await fetch(`/api/studio?${qs}`, {
      method: 'POST',
      headers: { 'x-studio-password': password, 'Content-Type': type },
      body,
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) signOut('Wrong password.');
    if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
    return data;
  }

  async function refresh() {
    const r = await fetch('/api/series?fresh=1', { headers: { 'x-studio-password': password } });
    if (r.status === 401) signOut('Wrong password.');
    if (!r.ok) throw new Error(`Could not load the series (${r.status})`);
    stories = (await r.json()).stories || [];
    show();
  }

  /* ---------- sign in ---------- */
  function signOut(msg = '') {
    password = '';
    try { sessionStorage.removeItem(KEY); } catch {}
    $('#app').hidden = true;
    $('#logout').hidden = true;
    $('#login').hidden = false;
    status('#login-status', msg, msg ? 'err' : '');
  }

  async function enter() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#logout').hidden = false;
    try {
      await refresh();
      // start on the story that was updated most recently
      const latest = [...stories].filter((s) => s.updatedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
      if (latest) {
        $('#kind').value = latest.kind;
        $('#number').value = String(latest.number).padStart(2, '0');
        show();
      }
    } catch (e) {
      status('#pages-status', e.message, 'err');
    }
  }

  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    password = $('#password').value;
    status('#login-status', 'Checking…');
    try {
      await api('check');
      try { sessionStorage.setItem(KEY, password); } catch {}
      $('#password').value = '';
      status('#login-status', '');
      enter();
    } catch (err) {
      if (password) signOut(err.message);
    }
  });
  $('#logout').addEventListener('click', () => signOut());

  /* ---------- story picker ---------- */
  for (let n = 1; n <= 20; n++) {
    const v = String(n).padStart(2, '0');
    $('#number').append(new Option(v, v));
  }
  $('#kind').addEventListener('change', show);
  $('#number').addEventListener('change', show);

  function show() {
    const s = current();
    const name = `${$('#kind').value === 'scroll' ? 'Scroll' : 'Story'} ${$('#number').value}`;
    $('#story-info').textContent = s && s.panels.length
      ? `${name} has ${s.panels.length} page${s.panels.length === 1 ? '' : 's'} online. Last added ${new Date(s.updatedAt).toLocaleDateString()}.`
      : `${name} has no pages yet. Its card on the series page says "Coming soon" until you upload some.`;
    $('#title').value = s ? s.title : '';
    $('#blurb').value = s ? s.blurb : '';
    status('#meta-status', '');

    const list = $('#pages');
    list.replaceChildren();
    (s ? s.panels : []).forEach((p, i) => {
      const li = document.createElement('li');
      const img = new Image(p.w, p.h);
      img.src = p.url;
      img.alt = `Page ${i + 1}`;
      img.loading = 'lazy';
      const n = document.createElement('span');
      n.textContent = i + 1;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete';
      del.addEventListener('click', () => remove(p, i + 1));
      li.append(img, n, del);
      list.append(li);
    });
    status('#pages-status', s && s.panels.length ? '' : 'Nothing online for this story yet.');
  }

  /* ---------- title and blurb ---------- */
  $('#meta').addEventListener('submit', async (e) => {
    e.preventDefault();
    status('#meta-status', 'Saving…');
    try {
      await api('meta', { story: slug() }, JSON.stringify({ title: $('#title').value.trim(), blurb: $('#blurb').value.trim() }));
      await refresh();
      status('#meta-status', 'Saved. The public page shows it within about 5 minutes.', 'ok');
    } catch (err) {
      status('#meta-status', err.message, 'err');
    }
  });

  /* ---------- picking files ---------- */
  function pick(files) {
    picked = [...files]
      .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    $('#picked').textContent = picked.length ? `${picked.length} image${picked.length === 1 ? '' : 's'}: ${picked.map((f) => f.name).join(', ')}` : '';
    $('#upload').disabled = !picked.length;
    status('#upload-status', '');
  }
  $('#files').addEventListener('change', (e) => pick(e.target.files));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); pick(e.dataTransfer.files); });

  /* ---------- resize in the browser ---------- */
  async function decode(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  async function toJpeg(file, max) {
    let src;
    try { src = await decode(file); } catch {
      throw new Error(`Couldn't read ${file.name}. Export it as JPG or PNG and try again.`);
    }
    const sw = src.width, sh = src.height;
    let scale = Math.min(1, max.w / sw, max.h / sh);
    for (let attempt = 0; attempt < 6; attempt++) {
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; // transparent PNGs get a white page
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, w, h);
      for (const q of [0.86, 0.78, 0.7]) {
        const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', q));
        if (blob && blob.size <= MAX_BYTES) return { blob, w, h };
      }
      scale *= 0.8; // still too heavy: make it a bit smaller
    }
    throw new Error(`${file.name} is too large even after resizing.`);
  }

  /* ---------- upload ---------- */
  $('#upload').addEventListener('click', async () => {
    const story = slug();
    const max = SIZES[$('#kind').value];
    const files = picked;
    const batch = Date.now();
    $('#upload').disabled = true;
    let done = 0;
    try {
      for (const [i, file] of files.entries()) {
        status('#upload-status', `Preparing ${i + 1} of ${files.length}: ${file.name}`);
        const { blob, w, h } = await toJpeg(file, max);
        status('#upload-status', `Uploading ${i + 1} of ${files.length}: ${file.name}`);
        await api('upload', { story, order: `${batch}-${String(i).padStart(3, '0')}`, w, h }, blob, 'image/jpeg');
        done++;
      }
      $('#files').value = '';
      pick([]);
      await refresh();
      status('#upload-status', `Done: ${done} page${done === 1 ? '' : 's'} added. The public page shows them within about 5 minutes.`, 'ok');
    } catch (err) {
      status('#upload-status', `${err.message}${done ? ` (${done} uploaded before this, they're online.)` : ''}`, 'err');
      $('#upload').disabled = !picked.length;
      refresh().catch(() => {});
    }
  });

  /* ---------- delete ---------- */
  async function remove(p, n) {
    if (!confirm(`Delete page ${n}? This can't be undone.`)) return;
    status('#pages-status', `Deleting page ${n}…`);
    try {
      await api('delete', {}, JSON.stringify({ url: p.url }));
      await refresh();
      status('#pages-status', `Page ${n} deleted.`, 'ok');
    } catch (err) {
      status('#pages-status', err.message, 'err');
    }
  }

  if (password) enter();
})();
