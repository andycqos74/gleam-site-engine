// Chat assistant popup (src/assistant.js, markup from src/document.js). Posts each question to /_chat as JSON and
// shows the reply ({ conversationId, text } or { error }). The conversation and open state are kept in
// sessionStorage, so they survive moving between pages and go when the tab closes. Text is only ever set with
// textContent; replies support **bold**, # headings, - bullets and [links](/page).
(function () {
  const root = document.querySelector('[data-gchat]');
  if (!root) return;
  const panel = root.querySelector('#gchat-panel');
  const toggle = root.querySelector('[data-gchat-toggle]');
  const count = root.querySelector('[data-gchat-count]');
  const teaser = root.querySelector('[data-gchat-teaser]');
  const log = root.querySelector('[data-gchat-log]');
  const form = root.querySelector('[data-gchat-form]');
  const input = form.querySelector('textarea');
  const send = form.querySelector('.gchat-send');
  const name = root.dataset.name || 'us';
  let config = { greeting: '', suggestions: [] };
  try { config = JSON.parse(root.querySelector('[data-gchat-config]').textContent); } catch (e) {}
  const KEY = 'gleamChat';
  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const small = window.matchMedia('(max-width: 600px)');
  let state = { open: false, teaserSeen: false, unread: 0, conversationId: null, items: [] };
  try { state = Object.assign(state, JSON.parse(sessionStorage.getItem(KEY)) || {}); } catch (e) {}
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const time = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  let closeTimer;

  // Links: pages on this site and https addresses only.
  const safeHref = (u) => (/^\/(?![/\\])/.test(u) || /^https:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u) ? u : null);
  function inline(parent, s) {
    s.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/).forEach((part) => {
      if (!part) return;
      const bold = part.match(/^\*\*([^*]+)\*\*$/);
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (bold) parent.append(el('strong', null, bold[1]));
      else if (link && safeHref(link[2])) {
        const a = el('a', null, link[1]);
        a.href = link[2];
        if (/^https:/i.test(link[2]) && new URL(link[2]).host !== location.host) { a.target = '_blank'; a.rel = 'noopener'; }
        parent.append(a);
      } else parent.append(document.createTextNode(link ? link[1] : part));
    });
  }
  function format(text) {
    const frag = document.createDocumentFragment();
    String(text).replace(/\r/g, '').trim().split(/\n{2,}/).forEach((block) => {
      let p = null; let ul = null;
      block.split('\n').forEach((line) => {
        const h = line.match(/^#{1,4}\s+(.*)$/);
        const li = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/);
        if (h) { p = ul = null; const t = el('p', 'gchat-h'); inline(t, h[1]); frag.append(t); return; }
        if (li) { p = null; if (!ul) { ul = el('ul'); frag.append(ul); } const item = el('li'); inline(item, li[1]); ul.append(item); return; }
        ul = null;
        if (!p) { p = el('p'); frag.append(p); } else p.append(document.createElement('br'));
        inline(p, line);
      });
    });
    return frag;
  }

  function showCount() {
    const c = state.open ? 0 : state.unread;
    count.hidden = !c; count.textContent = c > 9 ? '9+' : String(c);
    toggle.setAttribute('aria-label', state.open ? 'Close chat' : c ? `Open chat, ${c} unread` : 'Open chat');
  }
  function hideTeaser() { if (!teaser || teaser.hidden) return; teaser.classList.remove('in'); setTimeout(() => { teaser.hidden = true; }, reduce() ? 0 : 230); }
  function setOpen(open, focus) {
    state.open = open;
    if (open) { state.unread = 0; state.teaserSeen = true; hideTeaser(); }
    save(); showCount();
    document.documentElement.classList.toggle('gchat-is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    clearTimeout(closeTimer);
    if (open) {
      panel.hidden = false;
      void panel.offsetWidth; // let the closed state paint so the opening transition runs
      root.classList.add('open');
      scroll();
      // Don't pop up the phone keyboard when the panel reopens by itself on a new page.
      if (focus && !small.matches) input.focus(); else if (focus) panel.querySelector('[data-gchat-close]').focus();
    } else {
      const inside = panel.contains(document.activeElement);
      root.classList.remove('open');
      closeTimer = setTimeout(() => { if (!state.open) panel.hidden = true; }, reduce() ? 0 : 230);
      if (inside || focus) toggle.focus();
    }
  }

  toggle.addEventListener('click', () => setOpen(!state.open, true));
  root.querySelector('[data-gchat-close]').addEventListener('click', () => setOpen(false, true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.open) setOpen(false, true); });
  // Any [data-gchat-open] element on the page opens the chat (the teaser, or an "Ask us" button in a theme).
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-gchat-open]')) return;
    e.preventDefault();
    setOpen(true, true);
  });
  if (location.hash === '#chat') { state.open = true; history.replaceState(null, '', location.pathname + location.search); }

  if (teaser && !state.open && !state.teaserSeen && !state.items.length) {
    setTimeout(() => {
      if (state.open || state.teaserSeen) return;
      teaser.hidden = false; void teaser.offsetWidth; teaser.classList.add('in');
      state.unread = Math.max(state.unread, 1); showCount();
    }, 4000);
    root.querySelector('[data-gchat-teaser-x]').addEventListener('click', () => { state.teaserSeen = true; state.unread = 0; save(); showCount(); hideTeaser(); });
  }

  function bubble(kind, text, at) {
    const row = el('div', `gchat-row ${kind}`);
    const msg = el('div', 'gchat-msg');
    const body = el('div', 'gchat-body');
    body.append(format(text));
    msg.append(el('span', 'gchat-sr', `${kind === 'me' ? 'You' : name}, `), body);
    if (at) msg.append(el('span', 'gchat-time', at));
    row.append(msg);
    log.append(row);
    return row;
  }
  function render(item) { bubble(item.role === 'user' ? 'me' : item.role === 'error' ? 'err' : 'bot', item.text, item.at); }
  function add(item) { state.items.push(item); save(); render(item); scroll(); }

  function greet() {
    log.replaceChildren();
    if (config.greeting) bubble('bot', config.greeting);
    if (!state.items.length && config.suggestions && config.suggestions.length) {
      const list = el('div', 'gchat-suggest');
      config.suggestions.forEach((q) => {
        const b = el('button', 'gchat-chip', q);
        b.type = 'button';
        b.addEventListener('click', () => ask(q));
        list.append(b);
      });
      log.append(list);
    }
  }

  async function post(message) {
    try {
      const res = await fetch('/_chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ conversationId: state.conversationId, message }),
        credentials: 'same-origin',
      });
      const reply = await res.json().catch(() => ({}));
      if (reply.conversationId) { state.conversationId = reply.conversationId; save(); }
      if (!res.ok && !reply.error) return { error: 'Message not sent. Try again.' };
      return reply;
    } catch (e) {
      return { error: 'Message not sent. Check your connection and try again.' };
    }
  }

  async function ask(text) {
    if (!text || send.disabled) return;
    const chips = log.querySelector('.gchat-suggest');
    if (chips) chips.remove();
    add({ role: 'user', text, at: time() });
    send.disabled = true;
    const typing = el('div', 'gchat-row bot');
    const dots = el('div', 'gchat-typing');
    dots.setAttribute('role', 'status');
    dots.setAttribute('aria-label', `${name} is typing`);
    dots.append(el('i'), el('i'), el('i'));
    typing.append(dots); log.append(typing); scroll();
    const reply = await post(text);
    typing.remove();
    if (reply.error) add({ role: 'error', text: reply.error, at: time() });
    else add({ role: 'assistant', text: reply.text || 'Sorry, there was no reply. Try again.', at: time() });
    if (!state.open) { state.unread++; save(); showCount(); }
    send.disabled = false;
  }

  greet();
  state.items.forEach(render);
  if (state.open) setOpen(true, false); else showCount();

  root.querySelector('[data-gchat-new]').addEventListener('click', () => {
    state.conversationId = null; state.items = []; save();
    greet(); input.focus();
  });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    input.value = ''; input.style.height = '';
    ask(text);
  });
}());
