// In-place editor. Loaded only for signed-in users in edit mode (see src/pages/kit.js for the data-* markers).
(() => {
  const config = JSON.parse(document.getElementById('edit-config').textContent);
  const COLLS = config.collections;
  const dirty = { fields: {}, items: {} };
  let dirtyCount = 0;

  const bar = document.querySelector('[data-admin-bar]');
  const saveBtn = bar.querySelector('[data-ed-action="save"]');
  const discardBtn = bar.querySelector('[data-ed-action="discard"]');

  // ---------- helpers ----------
  const el = (tag, props = {}, children = []) => {
    const node = Object.assign(document.createElement(tag), props);
    for (const c of [].concat(children)) if (c != null) node.append(c);
    return node;
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(method, url, body, { form } = {}) {
    const res = await fetch(url, {
      method,
      headers: { 'X-CSRF-Token': config.csrf, Accept: 'application/json', ...(form ? {} : { 'Content-Type': 'application/json' }) },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    let data = {};
    try { data = await res.json(); } catch { /* not JSON */ }
    if (!res.ok) throw new Error(data.error || `Something went wrong (${res.status}).`);
    return data;
  }

  let toastTimer;
  function toast(message, { error = false, sticky = false } = {}) {
    let t = document.querySelector('.ed-toast');
    if (!t) t = document.body.appendChild(el('div', { className: 'ed-toast', role: 'status' }));
    t.textContent = message;
    t.classList.toggle('is-error', error);
    t.hidden = false;
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => { t.hidden = true; }, error ? 7000 : 2500);
  }

  function reload(hash = '') {
    sessionStorage.setItem('ed-scroll', String(window.scrollY));
    if (hash) location.hash = hash;
    location.reload();
  }
  const savedScroll = sessionStorage.getItem('ed-scroll');
  if (savedScroll) {
    sessionStorage.removeItem('ed-scroll');
    window.scrollTo(0, Number(savedScroll));
  }

  // Where a value is stored: a single field (data-k) or a field of the surrounding list item (data-f).
  function target(node, kAttr = 'k', fAttr = 'f') {
    const key = node.dataset[kAttr];
    if (key) return { key };
    const field = node.dataset[fAttr];
    const item = node.closest('[data-item]');
    if (field && item) return { id: item.dataset.id, coll: item.dataset.item, field };
    return null;
  }

  function markDirty(t, value) {
    if (!t) return;
    if (t.key) dirty.fields[t.key] = value;
    else (dirty.items[t.id] ??= {})[t.field] = value;
    dirtyCount = Object.keys(dirty.fields).length + Object.values(dirty.items).reduce((n, o) => n + Object.keys(o).length, 0);
    saveBtn.disabled = discardBtn.disabled = dirtyCount === 0;
    saveBtn.textContent = dirtyCount ? `Save changes (${dirtyCount})` : 'Save changes';
  }

  async function save() {
    if (!dirtyCount) return true;
    saveBtn.disabled = true;
    toast('Saving…', { sticky: true });
    try {
      await api('POST', '/api/save', dirty);
      dirty.fields = {}; dirty.items = {};
      markDirty(null);
      dirtyCount = 0;
      saveBtn.disabled = discardBtn.disabled = true;
      saveBtn.textContent = 'Save changes';
      toast('Saved. Visitors can see your changes now.');
      return true;
    } catch (e) {
      saveBtn.disabled = false;
      toast(e.message, { error: true });
      return false;
    }
  }

  window.addEventListener('beforeunload', (e) => {
    if (dirtyCount) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- text ----------
  const supportsPlain = (() => { const d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; })();
  const plainText = (node) => node.innerText.replace(/ /g, ' ');

  function insertPlain(e) {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  document.querySelectorAll('[data-type="text"], [data-type="textarea"]').forEach((node) => {
    const multi = node.dataset.type === 'textarea';
    node.contentEditable = supportsPlain ? 'plaintext-only' : 'true';
    node.spellcheck = true;
    node.classList.add('ed-text');
    if (!node.title) node.title = multi ? 'Click to edit. Enter starts a new line.' : 'Click to edit';
    node.addEventListener('paste', insertPlain);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !multi) { e.preventDefault(); node.blur(); }
      if (e.key === 'Escape') node.blur();
    });
    node.addEventListener('input', () => {
      const v = multi ? plainText(node).replace(/\n{3,}/g, '\n\n').trim() : plainText(node).replace(/\s+/g, ' ').trim();
      markDirty(target(node), v);
    });
  });

  // Headlines: words in [square brackets] become the coloured pills.
  const pillColours = (node) => (node.dataset.pills || 'gold,blue').split(',');
  const rawHeadline = (node) => [...node.childNodes].map((n) => (n.nodeType === 1 && n.classList.contains('pill') ? `[${n.textContent}]` : n.textContent)).join('');
  const renderHeadline = (node, raw) => {
    const colours = pillColours(node);
    let i = 0;
    node.innerHTML = esc(raw).replace(/\[([^\]]+)\]/g, (_, w) => {
      const c = colours[i % colours.length];
      return `<span class="pill pill-${c} pill-${i++ % 2 ? 'b' : 'a'}">${w}</span>`;
    });
  };
  document.querySelectorAll('[data-type="headline"]').forEach((node) => {
    node.classList.add('ed-text');
    node.title = 'Click to edit. Put [square brackets] around words to highlight them.';
    node.tabIndex = 0;
    const start = () => {
      if (node.isContentEditable) return;
      const raw = rawHeadline(node);
      node.textContent = raw;
      node.contentEditable = supportsPlain ? 'plaintext-only' : 'true';
      node.classList.add('ed-headline-raw');
      node.focus();
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      showHint(node, 'Words in [square brackets] are highlighted.');
    };
    node.addEventListener('click', start);
    node.addEventListener('focus', start);
    node.addEventListener('paste', insertPlain);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); node.blur(); } });
    node.addEventListener('input', () => markDirty(target(node), plainText(node).replace(/\s+/g, ' ').trim()));
    node.addEventListener('blur', () => {
      const raw = plainText(node).replace(/\s+/g, ' ').trim();
      node.contentEditable = 'false';
      node.classList.remove('ed-headline-raw');
      renderHeadline(node, raw);
      hideHint();
    });
  });

  let hintEl;
  function showHint(node, text) {
    hideHint();
    const r = node.getBoundingClientRect();
    hintEl = document.body.appendChild(el('div', { className: 'ed-hint', textContent: text }));
    hintEl.style.top = `${window.scrollY + r.top - 34}px`;
    hintEl.style.left = `${window.scrollX + r.left}px`;
  }
  function hideHint() { hintEl?.remove(); hintEl = null; }

  // ---------- rich text ----------
  let richBar;
  document.querySelectorAll('[data-type="rich"]').forEach((node) => {
    node.contentEditable = 'true';
    node.classList.add('ed-text', 'ed-rich');
    node.addEventListener('paste', insertPlain);
    node.addEventListener('input', () => markDirty(target(node), node.innerHTML));
    node.addEventListener('focus', () => {
      richBar?.remove();
      richBar = el('div', { className: 'ed-richbar' }, [
        ['B', 'bold', 'Bold'], ['I', 'italic', 'Italic'], ['H', 'formatBlock:h2', 'Heading'], ['¶', 'formatBlock:p', 'Normal text'],
        ['• List', 'insertUnorderedList', 'Bulleted list'], ['Link', 'link', 'Make a link'], ['Unlink', 'unlink', 'Remove link'],
      ].map(([label, cmd, title]) => el('button', { type: 'button', textContent: label, title, onmousedown: (e) => {
        e.preventDefault();
        if (cmd === 'link') {
          const url = prompt('Link address (for example https://example.org, /contact or someone@example.com):');
          if (url) document.execCommand('createLink', false, /^[^@\s]+@[^@\s]+$/.test(url) ? `mailto:${url}` : url);
        } else if (cmd.startsWith('formatBlock:')) document.execCommand('formatBlock', false, cmd.split(':')[1]);
        else document.execCommand(cmd);
        markDirty(target(node), node.innerHTML);
      } })));
      node.before(richBar);
    });
    node.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== node) { richBar?.remove(); richBar = null; } }, 150));
  });

  // ---------- links ----------
  let linkPop;
  function closeLinkPop() { linkPop?.remove(); linkPop = null; }
  function openLinkPop(node) {
    const t = target(node, 'linkK', 'linkF');
    if (!t) return;
    if (linkPop?.dataset.for === (t.key || `${t.id}:${t.field}`)) return;
    closeLinkPop();
    const current = (t.key ? dirty.fields[t.key] : dirty.items[t.id]?.[t.field]) ?? node.getAttribute('href') ?? '';
    const input = el('input', { type: 'text', value: current === '#' ? '' : current, placeholder: 'https://… or /contact or name@example.com' });
    input.addEventListener('input', () => {
      markDirty(t, input.value.trim());
      node.setAttribute('href', input.value.trim() || '#');
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); closeLinkPop(); } });
    linkPop = el('div', { className: 'ed-pop ed-linkpop' }, [
      el('label', {}, ['Button goes to', input]),
      el('button', { type: 'button', className: 'ed-pop-close', textContent: 'Done', onclick: closeLinkPop }),
    ]);
    linkPop.dataset.for = t.key || `${t.id}:${t.field}`;
    document.body.append(linkPop);
    const r = node.getBoundingClientRect();
    linkPop.style.top = `${window.scrollY + r.bottom + 8}px`;
    linkPop.style.left = `${Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - 360))}px`;
  }
  document.querySelectorAll('[data-link-k], [data-link-f]').forEach((node) => {
    node.classList.add('ed-link');
    node.addEventListener('focus', () => openLinkPop(node));
    node.addEventListener('click', () => openLinkPop(node));
  });
  document.addEventListener('mousedown', (e) => {
    if (linkPop && !linkPop.contains(e.target) && !e.target.closest('[data-link-k], [data-link-f]')) closeLinkPop();
  });

  // Don't follow links or submit forms on the page while editing.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.ed-ui, [data-admin-bar], .ed-drawer, .ed-modal')) return;
    const a = e.target.closest('a');
    // Links in the page header (or marked data-ed-nav) still navigate, so editors can move between pages.
    const nav = a && !a.closest('[data-k], [data-f], [data-link-k], [data-link-f]') && a.closest('header, [data-ed-nav]');
    if (a && !nav) e.preventDefault();
    if (nav && dirtyCount && !confirm('You have unsaved changes. Leave this page without saving?')) e.preventDefault();
  }, true);
  document.querySelectorAll('main form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));

  // ---------- images ----------
  const srcset = (url) => {
    const m = /^\/media\/([\w-]+)-1600\.webp$/.exec(url || '');
    return m ? `/media/${m[1]}-800.webp 800w, ${url} 1600w` : '';
  };

  function setImage(node, url) {
    let next;
    if (url) {
      next = node.tagName === 'IMG' ? node : el('img');
      next.src = url;
      const set = srcset(url);
      if (set) { next.srcset = set; next.sizes = node.getAttribute('sizes') || '(max-width: 900px) 100vw, 50vw'; } else next.removeAttribute('srcset');
    } else {
      next = el('div', {}, el('span', { className: 'ph-label', textContent: 'Add photo' }));
    }
    if (next !== node) {
      next.className = [...node.classList].filter((c) => c !== 'ph').join(' ');
      if (!url) next.classList.add('ph');
      for (const a of node.attributes) if (a.name.startsWith('data-')) next.setAttribute(a.name, a.value);
      if (node.getAttribute('alt') && url) next.alt = node.getAttribute('alt');
      node.replaceWith(next);
      bindImage(next);
    }
    markDirty(target(next), url);
  }

  function pickFile() {
    return new Promise((resolve) => {
      const input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif' });
      input.addEventListener('change', () => resolve(input.files[0] || null));
      input.click();
    });
  }

  async function upload(file) {
    const form = new FormData();
    form.append('file', file);
    toast('Uploading photo…', { sticky: true });
    const data = await api('POST', '/api/media', null, { form });
    toast('Photo uploaded. Remember to save.');
    return data.url;
  }

  async function uploadInto(callback) {
    const file = await pickFile();
    if (!file) return;
    try { callback(await upload(file)); } catch (e) { toast(e.message, { error: true }); }
  }

  async function library(callback) {
    const modal = el('div', { className: 'ed-modal', role: 'dialog', ariaModal: 'true', ariaLabel: 'Choose a photo' });
    const grid = el('div', { className: 'ed-library' }, el('p', { textContent: 'Loading…' }));
    modal.append(el('div', { className: 'ed-modal-box' }, [
      el('div', { className: 'ed-modal-head' }, [el('h2', { textContent: 'Choose a photo' }), el('button', { type: 'button', className: 'ed-btn', textContent: 'Close', onclick: () => modal.remove() })]),
      grid,
    ]));
    document.body.append(modal);
    try {
      const { media } = await api('GET', '/api/media');
      grid.replaceChildren(...media.map((m) => el('button', {
        type: 'button', className: 'ed-thumb', title: m.name,
        onclick: () => { modal.remove(); callback(m.url); },
      }, el('img', { src: m.url.replace(/-1600\.webp$/, '-800.webp'), alt: m.name, loading: 'lazy' }))));
    } catch (e) {
      grid.replaceChildren(el('p', { textContent: e.message }));
    }
  }

  let imgMenu;
  function closeImgMenu() { imgMenu?.remove(); imgMenu = null; }
  function bindImage(node) {
    node.classList.add('ed-img');
    node.tabIndex = 0;
    node.title = 'Click to change this photo';
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeImgMenu();
      const altT = node.dataset.altK ? { key: node.dataset.altK } : node.dataset.altF ? target(node, 'altK', 'altF') : null;
      const items = [
        ['Upload a new photo', () => uploadInto((url) => setImage(node, url))],
        ['Choose an uploaded photo', () => library((url) => setImage(node, url))],
      ];
      if (altT) items.push(['Describe the photo', () => {
        const current = (altT.key ? dirty.fields[altT.key] : dirty.items[altT.id]?.[altT.field]) ?? node.getAttribute('alt') ?? '';
        const v = prompt('Describe the photo for people using screen readers (for example "Children playing football at Queens Arena"):', current);
        if (v != null) { markDirty(altT, v.trim()); if (node.tagName === 'IMG') node.alt = v.trim(); }
      }]);
      const src = node.tagName === 'IMG' ? node.getAttribute('src') : '';
      if (/^\/(media|img)\//.test(src || '')) items.push(['Animate this photo…', () => animatePanel(src, node.getAttribute('alt') || '')]);
      if (node.tagName === 'IMG') items.push(['Remove photo', () => setImage(node, '')]);
      imgMenu = el('div', { className: 'ed-pop ed-imgmenu ed-ui' }, items.map(([label, fn]) => el('button', { type: 'button', textContent: label, onclick: () => { closeImgMenu(); fn(); } })));
      document.body.append(imgMenu);
      const r = node.getBoundingClientRect();
      imgMenu.style.top = `${window.scrollY + r.top + Math.min(r.height / 2, 120)}px`;
      imgMenu.style.left = `${Math.max(8, window.scrollX + r.left + Math.min(r.width / 2, 160) - 110)}px`;
      imgMenu.querySelector('button').focus();
    };
    node.addEventListener('click', open);
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); });
  }
  document.querySelectorAll('[data-type="image"]').forEach(bindImage);
  document.addEventListener('mousedown', (e) => { if (imgMenu && !imgMenu.contains(e.target)) closeImgMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeImgMenu(); closeLinkPop(); } });

  // ---------- list items ----------
  async function structural(fn) {
    if (dirtyCount && !(await save())) return;
    try { await fn(); } catch (e) { toast(e.message, { error: true }); }
  }

  document.querySelectorAll('[data-item]').forEach((item) => {
    const coll = COLLS[item.dataset.item];
    const id = item.dataset.id;
    // Arrows point the way the list runs on screen: across for multi-column grids and rows, down otherwise.
    const ps = getComputedStyle(item.parentElement);
    const horizontal = (ps.display.includes('grid') && ps.gridTemplateColumns.trim().split(/\s+/).length > 1)
      || (ps.display.includes('flex') && ps.flexDirection.startsWith('row'));
    const isHidden = item.classList.contains('ed-hidden');
    const tools = el('div', { className: 'ed-item-tools ed-ui' }, [
      el('span', { className: 'ed-item-label', textContent: coll.label + (isHidden ? ' (hidden)' : '') }),
      el('button', { type: 'button', title: 'Edit all details', textContent: '✎', onclick: () => openItemDrawer(id) }),
      // Lists sorted by date (news) have no manual order.
      coll.sortBy ? null : el('button', { type: 'button', title: 'Move earlier', textContent: horizontal ? '←' : '↑', onclick: () => structural(async () => { await api('POST', `/api/items/${id}/move`, { dir: -1 }); reload(); }) }),
      coll.sortBy ? null : el('button', { type: 'button', title: 'Move later', textContent: horizontal ? '→' : '↓', onclick: () => structural(async () => { await api('POST', `/api/items/${id}/move`, { dir: 1 }); reload(); }) }),
      el('button', { type: 'button', title: isHidden ? 'Show to visitors' : 'Hide from visitors', textContent: isHidden ? '👁 Show' : '👁', onclick: () => structural(async () => { await api('PUT', `/api/items/${id}`, { data: { hidden: !isHidden } }); reload(); }) }),
      el('button', { type: 'button', title: 'Delete', textContent: '🗑', className: 'ed-danger', onclick: () => structural(async () => {
        if (!confirm(`Delete this ${coll.label.toLowerCase()}? You can put it back from Admin > Change history.`)) return;
        await api('DELETE', `/api/items/${id}`);
        // On a page that is this item (a news article), go back to the list instead of reloading a missing page.
        if (item.dataset.afterDelete) { dirtyCount = 0; location.href = item.dataset.afterDelete; } else reload();
      }) }),
    ]);
    item.classList.add('ed-item');
    item.append(tools);
  });

  document.querySelectorAll('[data-coll]').forEach((container) => {
    const name = container.dataset.coll;
    const defaults = container.dataset.collDefaults ? JSON.parse(container.dataset.collDefaults) : {};
    const btn = el('button', { type: 'button', className: 'ed-add ed-ui', textContent: `+ Add ${container.dataset.collLabel.toLowerCase()}` });
    btn.addEventListener('click', () => structural(async () => {
      const { id } = await api('POST', '/api/items', { coll: name, data: defaults });
      // Items with their own page (e.g. news articles) open there, where their main text is written.
      if (COLLS[name].itemBase) location.href = `${COLLS[name].itemBase}/${id}#ed-open-${id}`;
      else reload(`ed-open-${id}`);
    }));
    container.after(btn);
  });

  // ---------- animated photos (src/anim, /_engine/animated-image.js) ----------
  // Pick a preset, switch effects on and off, adjust strength and speed, or describe the animation and let Claude
  // propose settings. The preview plays exactly what visitors will see; nothing changes for them until "Save
  // animation". Applies to this photo wherever it appears on the site.
  let playerLoading;
  const loadPlayer = () => playerLoading ??= new Promise((ok, no) => {
    if (customElements.get('animated-image')) return ok();
    document.head.append(el('script', { src: '/_engine/animated-image.js', onload: ok, onerror: no }));
  });

  async function animatePanel(src, alt) {
    let info;
    toast('Looking at the photo…', { sticky: true });
    try {
      [info] = await Promise.all([api('POST', '/api/animations/panel', { src }), loadPlayer()]);
      document.querySelector('.ed-toast').hidden = true;
    } catch (e) { return toast(e.message, { error: true }); }

    const clone = (o) => JSON.parse(JSON.stringify(o));
    let cfg = clone(info.config ?? info.presets[info.suggested].config);
    let presetKey = info.config ? null : info.suggested;
    let drawing = false;

    const modal = el('div', { className: 'ed-modal ed-anim', role: 'dialog', ariaModal: 'true', ariaLabel: 'Animate this photo' });
    const close = () => { modal.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const player = el('animated-image', { className: 'ed-anim-player' }, el('img', { src, alt }));
    player.setAttribute('src', info.analysisUrl);
    player.style.aspectRatio = `${info.width} / ${info.height}`;
    const box = el('div', { className: 'ed-anim-box' });
    const stage = el('div', { className: 'ed-anim-stage' }, [player, box]);

    const found = info.found.nodes || info.found.stars
      ? `Found ${info.found.nodes} lights and ${info.found.stars} small points of light in this photo.`
      : 'No lights found in this photo: drift, parallax and particles suit it best.';
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const presetRow = el('div', { className: 'ed-chips' });
    const effectRow = el('div', { className: 'ed-chips' });
    const particleBox = el('div', { className: 'ed-anim-particles' });
    const slider = (label, min, max, step, get, set, fmt) => {
      const out = el('output');
      const input = el('input', { type: 'range', min, max, step });
      input.addEventListener('input', () => { set(Number(input.value)); presetKey = null; refresh(); });
      return { row: el('label', { className: 'ed-field ed-range' }, [el('span', { className: 'ed-label' }, [label, ' ', out]), input]), sync: () => { input.value = get(); out.textContent = fmt(get()); } };
    };
    const intensity = slider('Strength', 0, 1, 0.05, () => cfg.intensity, (v) => { cfg.intensity = v; }, (v) => `${Math.round(v * 100)}%`);
    const speed = slider('Speed', 0.25, 2, 0.05, () => cfg.speed, (v) => { cfg.speed = v; }, (v) => `${v.toFixed(2)}×`);
    const pause = el('input', { type: 'checkbox', onchange: () => { cfg.pauseButton = pause.checked; refresh(); } });
    const note = el('p', { className: 'ed-anim-note', hidden: true, role: 'status' });

    const has = (type) => cfg.effects.some((e) => e.type === type);
    function toggle(fx) {
      if (has(fx.type)) cfg.effects = cfg.effects.filter((e) => e.type !== fx.type);
      else cfg.effects.push(clone(fx.defaults));
      presetKey = null; refresh();
    }

    function drawParticles() {
      const p = cfg.effects.find((e) => e.type === 'particles');
      if (!p) { particleBox.replaceChildren(); return; }
      const kind = el('select', { onchange: () => { p.kind = kind.value; refresh(); } }, info.particleKinds.map((k) => el('option', { value: k, textContent: k[0].toUpperCase() + k.slice(1), selected: p.kind === k })));
      const count = el('input', { type: 'range', min: 4, max: 60, step: 1, value: p.count ?? 24, oninput: () => { p.count = Number(count.value); refresh(false); } });
      const b = p.region?.bbox;
      particleBox.replaceChildren(
        el('label', { className: 'ed-field' }, [el('span', { className: 'ed-label', textContent: 'Particles' }), kind]),
        el('label', { className: 'ed-field ed-range' }, [el('span', { className: 'ed-label', textContent: 'How many' }), count]),
        el('p', { className: 'ed-help', textContent: b ? `Area: ${b[2]} × ${b[3]} pixels, at ${b[0]}, ${b[1]}. ` : 'Area: the middle of the photo. ' },
          el('button', { type: 'button', className: 'ed-btn ed-btn-sm', textContent: drawing ? 'Drag on the preview…' : 'Draw the area', onclick: () => { drawing = !drawing; stage.classList.toggle('is-drawing', drawing); drawParticles(); } })),
      );
    }

    // Drag a rectangle on the preview to set where particles appear (image pixels; the preview has the photo's shape).
    let start;
    const toImage = (e) => { const r = player.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
    stage.addEventListener('pointerdown', (e) => { if (!drawing) return; e.preventDefault(); start = toImage(e); stage.setPointerCapture(e.pointerId); });
    stage.addEventListener('pointermove', (e) => {
      if (!drawing || !start) return;
      const [x, y] = toImage(e);
      Object.assign(box.style, { display: 'block', left: `${Math.min(x, start[0]) * 100}%`, top: `${Math.min(y, start[1]) * 100}%`, width: `${Math.abs(x - start[0]) * 100}%`, height: `${Math.abs(y - start[1]) * 100}%` });
    });
    stage.addEventListener('pointerup', (e) => {
      if (!drawing || !start) return;
      const [x, y] = toImage(e);
      const p = cfg.effects.find((fx) => fx.type === 'particles');
      if (p && Math.abs(x - start[0]) > 0.02 && Math.abs(y - start[1]) > 0.02) {
        p.region = { bbox: [Math.round(Math.min(x, start[0]) * info.width), Math.round(Math.min(y, start[1]) * info.height), Math.round(Math.abs(x - start[0]) * info.width), Math.round(Math.abs(y - start[1]) * info.height)] };
      }
      start = null; drawing = false; stage.classList.remove('is-drawing'); box.style.display = 'none';
      refresh();
    });

    function refresh(redrawParticles = true) {
      player.setAttribute('config', JSON.stringify(cfg));
      presetRow.replaceChildren(...Object.entries(info.presets).map(([key, p]) => el('button', {
        type: 'button', className: 'ed-chip', textContent: p.label, ariaPressed: String(key === presetKey),
        onclick: () => { cfg = { ...clone(p.config), pauseButton: cfg.pauseButton ?? true }; presetKey = key; refresh(); },
      })));
      effectRow.replaceChildren(...info.effects.map((fx) => el('button', { type: 'button', className: 'ed-chip', textContent: fx.label, ariaPressed: String(has(fx.type)), onclick: () => toggle(fx) })));
      intensity.sync(); speed.sync();
      pause.checked = cfg.pauseButton !== false;
      if (redrawParticles) drawParticles();
    }

    const controls = [
      el('p', { className: 'ed-help', textContent: found + (reduce ? ' Your device asks for reduced motion, so the preview stays still (visitors with that setting see the still photo too).' : '') }),
      el('div', { className: 'ed-field' }, [el('span', { className: 'ed-label', textContent: 'Start from' }), presetRow]),
      el('div', { className: 'ed-field' }, [el('span', { className: 'ed-label', textContent: 'Effects' }), effectRow]),
      particleBox, intensity.row, speed.row,
      el('label', { className: 'ed-check' }, [pause, ' Show a pause button on the photo']),
    ];
    if (info.ai) {
      const prompt = el('textarea', { rows: 3, maxLength: 1000, placeholder: 'For example: make the lights twinkle and drift slowly towards the right' });
      const ask = el('button', { type: 'button', className: 'ed-btn', textContent: 'Ask Claude' });
      ask.addEventListener('click', async () => {
        if (!prompt.value.trim()) return prompt.focus();
        ask.disabled = true; ask.textContent = 'Thinking…';
        try {
          const r = await api('POST', '/api/animations/suggest', { src, prompt: prompt.value, config: cfg });
          cfg = r.config; presetKey = null; refresh();
          note.hidden = false;
          note.textContent = `${r.note || 'Here’s a suggestion.'}${r.needsReview ? ' Check where the particles appear: Claude estimated the area. Use “Draw the area” to adjust it.' : ''} Review the preview, then save.`;
          note.classList.toggle('is-warn', !!r.needsReview);
        } catch (e) { toast(e.message, { error: true }); }
        ask.disabled = false; ask.textContent = 'Ask Claude';
      });
      controls.push(el('div', { className: 'ed-field ed-anim-ai' }, [el('label', { className: 'ed-label', textContent: 'Or describe the animation' }), prompt, ask, note]));
    }

    const saveBtn = el('button', { type: 'button', className: 'ed-btn ed-primary', textContent: 'Save animation' });
    saveBtn.addEventListener('click', async () => {
      try {
        await api('PUT', '/api/animations', { src, config: cfg });
        close(); toast('Animation saved. Visitors see it now (it plays when you finish editing).');
      } catch (e) { toast(e.message, { error: true }); }
    });
    const foot = [saveBtn,
      el('button', { type: 'button', className: 'ed-btn', textContent: 'Reset to preset', onclick: () => { const k = presetKey ?? info.suggested; cfg = { ...clone(info.presets[k].config), pauseButton: cfg.pauseButton ?? true }; presetKey = k; note.hidden = true; refresh(); } })];
    if (info.saved) {
      foot.push(el('button', { type: 'button', className: 'ed-btn', textContent: 'Remove animation', onclick: async () => {
        if (!confirm('Show this photo still again, everywhere it appears?')) return;
        try { await api('PUT', '/api/animations', { src, config: null }); close(); toast('Animation removed.'); } catch (e) { toast(e.message, { error: true }); }
      } }));
    }
    foot.push(el('button', { type: 'button', className: 'ed-btn', textContent: 'Cancel', onclick: close }));

    modal.append(el('div', { className: 'ed-modal-box ed-anim-modal' }, [
      el('div', { className: 'ed-modal-head' }, [el('h2', { textContent: 'Animate this photo' }), el('button', { type: 'button', className: 'ed-btn', textContent: 'Close', onclick: close })]),
      el('div', { className: 'ed-anim-body' }, [el('div', { className: 'ed-anim-left' }, [stage, el('p', { className: 'ed-help', textContent: 'The animation applies to this photo wherever it appears on the site. Move the pointer over the preview to try the parallax.' })]), el('div', { className: 'ed-anim-controls' }, controls)]),
      el('div', { className: 'ed-drawer-foot' }, foot),
    ]));
    document.body.append(modal);
    document.addEventListener('keydown', onKey);
    refresh();
    saveBtn.focus();
  }

  // ---------- drawer (all fields of an item, or page settings) ----------
  function fieldInput(name, f, value) {
    const id = `ed-f-${name}`;
    let input;
    if (f.type === 'rich') {
      return el('div', { className: 'ed-field' }, [el('span', { className: 'ed-label', textContent: f.label }), el('p', { className: 'ed-help', textContent: 'Edit this on the page itself: click the text and use the formatting bar.' })]);
    }
    if (f.type === 'textarea') input = el('textarea', { id, name, value: value ?? '', rows: 4 });
    else if (f.type === 'date') input = el('input', { id, name, type: 'date', value: value ?? '', required: true });
    else if (f.type === 'select') {
      input = el('select', { id, name }, Object.entries(f.options).map(([v, label]) => el('option', { value: v, textContent: label, selected: v === value })));
    } else if (f.type === 'bool') {
      input = el('input', { id, name, type: 'checkbox', checked: !!value });
      return el('label', { className: 'ed-check', htmlFor: id }, [input, ` ${f.label}`]);
    } else if (f.type === 'image') {
      const hidden = el('input', { type: 'hidden', name, value: value ?? '' });
      const preview = el('div', { className: 'ed-preview' });
      const show = (url) => { hidden.value = url; preview.replaceChildren(url ? el('img', { src: url.replace(/-1600\.webp$/, '-800.webp'), alt: '' }) : el('span', { textContent: 'No photo' })); };
      show(value);
      return el('div', { className: 'ed-field' }, [
        el('span', { className: 'ed-label', textContent: f.label }), preview, hidden,
        el('div', { className: 'ed-row' }, [
          el('button', { type: 'button', className: 'ed-btn', textContent: 'Upload', onclick: () => uploadInto(show) }),
          el('button', { type: 'button', className: 'ed-btn', textContent: 'Choose uploaded', onclick: () => library(show) }),
          el('button', { type: 'button', className: 'ed-btn', textContent: 'Remove', onclick: () => show('') }),
        ]),
      ]);
    } else input = el('input', { id, name, type: 'text', value: value ?? '', placeholder: f.type === 'url' ? 'https://… or /contact or name@example.com' : '' });
    return el('div', { className: 'ed-field' }, [el('label', { className: 'ed-label', htmlFor: id, textContent: f.label }), input]);
  }

  function drawer(title, fields, values, onSave) {
    document.querySelector('.ed-drawer')?.remove();
    const form = el('form', { className: 'ed-form' }, Object.entries(fields).map(([n, f]) => fieldInput(n, f, values[n])));
    const box = el('aside', { className: 'ed-drawer', role: 'dialog', ariaLabel: title }, [
      el('div', { className: 'ed-drawer-head' }, [el('h2', { textContent: title }), el('button', { type: 'button', className: 'ed-btn', textContent: 'Close', onclick: () => box.remove() })]),
      form,
      el('div', { className: 'ed-drawer-foot' }, [
        el('button', { type: 'submit', className: 'ed-btn ed-primary', textContent: 'Save', onclick: (e) => { e.preventDefault(); form.requestSubmit(); } }),
        el('button', { type: 'button', className: 'ed-btn', textContent: 'Cancel', onclick: () => box.remove() }),
      ]),
    ]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      for (const [n, f] of Object.entries(fields)) {
        const input = form.elements[n];
        if (!input) continue;
        data[n] = f.type === 'bool' ? input.checked : input.value;
      }
      try { await onSave(data); } catch (err) { toast(err.message, { error: true }); }
    });
    document.body.append(box);
    form.querySelector('input, textarea, select')?.focus();
  }

  async function openItemDrawer(id) {
    if (dirtyCount && !(await save())) return;
    try {
      const { item } = await api('GET', `/api/items/${id}`);
      const coll = COLLS[item.coll];
      drawer(`Edit ${coll.label.toLowerCase()}`, coll.fields, item, async (data) => {
        await api('PUT', `/api/items/${id}`, { data });
        reload();
      });
    } catch (e) { toast(e.message, { error: true }); }
  }

  bar.querySelector('[data-ed-action="page-settings"]').addEventListener('click', () => {
    const fields = Object.fromEntries(config.pageFields.map((f) => [f.key, { type: f.type === 'textarea' ? 'textarea' : f.type === 'url' ? 'url' : 'text', label: f.label }]));
    const values = Object.fromEntries(config.pageFields.map((f) => [f.key, f.value]));
    if (!config.pageFields.length) return toast('This page has no extra settings.');
    drawer('Page settings', fields, values, async (data) => {
      if (dirtyCount && !(await save())) return;
      await api('POST', '/api/save', { fields: data });
      reload();
    });
  });

  const openMatch = /^#ed-open-(\d+)$/.exec(location.hash);
  if (openMatch) {
    history.replaceState(null, '', location.pathname + location.search);
    const node = document.querySelector(`[data-item][data-id="${openMatch[1]}"]`);
    node?.scrollIntoView({ block: 'center' });
    openItemDrawer(openMatch[1]);
  }

  // ---------- toolbar ----------
  saveBtn.addEventListener('click', save);
  discardBtn.addEventListener('click', () => {
    if (confirm('Throw away the changes you have not saved?')) { dirtyCount = 0; reload(); }
  });
  bar.querySelector('[data-ed-action="exit"]').addEventListener('click', async () => {
    if (dirtyCount && !confirm('You have unsaved changes. Finish without saving them?')) return;
    dirtyCount = 0;
    const form = el('form', { method: 'post', action: '/admin/edit-mode' }, [
      el('input', { type: 'hidden', name: '_csrf', value: config.csrf }),
      el('input', { type: 'hidden', name: 'on', value: '0' }),
      el('input', { type: 'hidden', name: 'next', value: location.pathname + location.search }),
    ]);
    document.body.append(form);
    form.submit();
  });

  document.body.prepend(el('div', { className: 'ed-banner ed-ui', textContent: 'Editing: click words to change them, click photos to replace them, then press Save changes.' }));
})();
