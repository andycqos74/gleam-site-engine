// Visitor behaviour: mobile menu, list filters, gallery lightbox and contact form validation.
// Everything works without this file too (lists simply show unfiltered, the form posts normally).
(() => {
  // ---- Mobile menu ----
  const menuBtn = document.querySelector('.menu-btn');
  const nav = document.getElementById('site-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = menuBtn.getAttribute('aria-expanded') !== 'true';
      menuBtn.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('open', open);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        menuBtn.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        menuBtn.focus();
      }
    });
  }

  // ---- Filters: chips with data-filter="name" filter children of [data-filter-target="name"] by data-<name> ----
  document.querySelectorAll('[data-filter]').forEach((group) => {
    const name = group.dataset.filter;
    const target = document.querySelector(`[data-filter-target="${name}"]`);
    if (!target) return;
    const chips = [...group.querySelectorAll('.filter-chip')];
    const empty = target.parentElement.querySelector('.filter-empty');

    const apply = (value) => {
      chips.forEach((c) => c.setAttribute('aria-checked', String(c.dataset.value === value)));
      let shown = 0;
      [...target.children].forEach((el) => {
        if (!(name in el.dataset)) return;
        const match = value === 'all' || el.dataset[name] === value;
        el.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
    };

    chips.forEach((chip, i) => {
      chip.tabIndex = chip.getAttribute('aria-checked') === 'true' ? 0 : -1;
      chip.addEventListener('click', () => {
        apply(chip.dataset.value);
        chips.forEach((c) => { c.tabIndex = c === chip ? 0 : -1; });
        const url = new URL(location.href);
        if (chip.dataset.value === 'all') url.searchParams.delete(name); else url.searchParams.set(name, chip.dataset.value);
        url.hash = '';
        history.replaceState(null, '', url);
      });
      // Arrow keys move between chips, as in any radio group.
      chip.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = chips[(i + step + chips.length) % chips.length];
        next.focus();
        next.click();
      });
    });

    const initial = new URLSearchParams(location.search).get(name);
    if (initial && chips.some((c) => c.dataset.value === initial)) apply(initial);
    // A link to one programme (#p-12) should not be hidden by a filter.
    if (location.hash) {
      const el = document.getElementById(location.hash.slice(1));
      if (el && el.hidden) apply('all');
      if (el) el.scrollIntoView();
    }
  });

  // ---- Gallery lightbox ----
  const dialog = document.querySelector('.lightbox');
  if (dialog && typeof dialog.showModal === 'function') {
    const img = dialog.querySelector('img');
    const caption = dialog.querySelector('.lightbox-caption');
    let current = 0;
    const visible = () => [...document.querySelectorAll('[data-lightbox]')].filter((b) => !b.closest('[hidden]'));
    const show = (i) => {
      const list = visible();
      if (!list.length) return;
      current = (i + list.length) % list.length;
      const btn = list[current];
      img.src = btn.dataset.lightbox;
      img.alt = btn.dataset.caption || '';
      caption.textContent = btn.dataset.caption || '';
    };
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lightbox]');
      if (!btn) return;
      show(visible().indexOf(btn));
      dialog.showModal();
    });
    dialog.querySelector('.lb-prev').addEventListener('click', () => show(current - 1));
    dialog.querySelector('.lb-next').addEventListener('click', () => show(current + 1));
    dialog.querySelector('.lb-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  // ---- Contact form ----
  const form = document.querySelector('.contact-form');
  if (form && !document.body.classList.contains('is-editing')) {
    const EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;
    const setError = (name, message) => {
      const input = form.elements[name];
      const label = input.closest('label');
      label.querySelector('.field-error')?.remove();
      input.removeAttribute('aria-invalid');
      input.removeAttribute('aria-describedby');
      if (!message) return;
      const span = document.createElement('span');
      span.className = 'field-error';
      span.id = `err-${name}`;
      span.textContent = message;
      label.append(span);
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', span.id);
    };
    const validate = () => {
      const errors = {};
      if (!form.elements.name.value.trim()) errors.name = 'Please tell us your name.';
      if (!EMAIL.test(form.elements.email.value.trim())) errors.email = 'Please enter a valid email address.';
      if (!form.elements.message.value.trim()) errors.message = 'Please write a message.';
      return errors;
    };
    const showErrors = (errors) => {
      ['name', 'email', 'message'].forEach((n) => setError(n, errors[n]));
      const first = ['name', 'email', 'message'].find((n) => errors[n]);
      if (first) form.elements[first].focus();
    };
    ['name', 'email', 'message'].forEach((n) => form.elements[n].addEventListener('blur', () => {
      if (form.elements[n].getAttribute('aria-invalid')) setError(n, validate()[n]);
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errors = validate();
      if (Object.keys(errors).length) return showErrors(errors);
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        const res = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new URLSearchParams(new FormData(form)),
        });
        const data = await res.json();
        if (res.ok) {
          const success = document.querySelector('.form-success');
          form.remove();
          success.hidden = false;
          success.tabIndex = -1;
          success.focus();
          return;
        }
        showErrors(data.errors || {});
        if (data.errors?.form) alert(data.errors.form);
      } catch {
        form.submit();
        return;
      }
      button.disabled = false;
      button.textContent = 'Send Message';
    });
  }
})();
