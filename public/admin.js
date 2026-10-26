// Admin pages: ask before destructive form posts (forms with data-confirm).
document.addEventListener('submit', (e) => {
  const message = e.target.dataset.confirm;
  if (message && !confirm(message)) e.preventDefault();
});

// Copy buttons (data-copy="text").
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    const was = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = was; }, 1500);
  } catch {
    prompt('Copy this link:', btn.dataset.copy);
  }
});

// Photo pickers (Admin > Business cards): upload to the photo library and keep the address in a hidden input.
for (const pick of document.querySelectorAll('[data-photo-pick]')) {
  const file = pick.querySelector('[data-photo-file]');
  const value = pick.querySelector('[data-photo-value]');
  const preview = pick.querySelector('[data-photo-preview]');
  const clear = pick.querySelector('[data-photo-clear]');
  const status = pick.querySelector('[data-photo-status]');
  const csrf = pick.closest('form').querySelector('input[name="_csrf"]').value;
  const show = (url) => {
    value.value = url;
    preview.hidden = !url;
    if (url) preview.src = url; else preview.removeAttribute('src');
    clear.hidden = !url;
  };
  pick.querySelector('[data-photo-choose]').addEventListener('click', () => file.click());
  clear.addEventListener('click', () => show(''));
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    const body = new FormData();
    body.append('file', file.files[0]);
    status.textContent = 'Uploading…';
    try {
      const res = await fetch('/api/media', { method: 'POST', headers: { 'X-CSRF-Token': csrf }, body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The upload didn\'t work.');
      show(data.url);
      status.textContent = 'Uploaded. Save to keep it.';
    } catch (err) {
      status.textContent = err.message;
    }
    file.value = '';
  });
}

// Colour pickers paired with a text box (data-colour-for="<input name>").
for (const picker of document.querySelectorAll('[data-colour-for]')) {
  const text = picker.form.elements[picker.dataset.colourFor];
  picker.addEventListener('input', () => { text.value = picker.value; });
  text.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(text.value)) picker.value = text.value; });
}
