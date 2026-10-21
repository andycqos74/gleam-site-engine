// Visitor behaviour: mobile menu, list filters, gallery lightbox and contact form validation.
// Everything works without this file too (lists simply show unfiltered, the form posts normally).
(() => {
  // ---- Motion: only when anim-init.js switched it on (not in edit mode or with reduced motion) ----
  const root = document.documentElement;
  const anim = root.classList.contains('anim');
  if (anim) {
    root.classList.add('anim-ready');
    const byPosition = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    // .shown starts the entrance; .settled afterwards hands transitions back to the normal hover styles.
    const reveal = (el, settleAfter) => {
      el.classList.add('shown');
      setTimeout(() => el.classList.add('settled'), settleAfter);
    };
    const watch = (selector, options, onEnter) => {
      const io = new IntersectionObserver((entries) => {
        const hits = entries.filter((e) => e.isIntersecting).map((e) => e.target).sort(byPosition);
        hits.forEach((el) => io.unobserve(el));
        onEnter(hits);
      }, options);
      document.querySelectorAll(selector).forEach((el) => io.observe(el));
    };

    // Cards, tiles and photos: fade up, staggered within each batch that scrolls into view together.
    watch(`.prog-card, .news-card, .stat, .principle, .story-card, .tile, .product, .pillar, .team-member, .venue-card, .prog-row, .vacancy, .funder,
      .photo-row > *, .about-photos > *, .camp-photos > *, .shop-arch`, { rootMargin: '0px 0px -8% 0px' }, (els) => {
      els.forEach((el, i) => {
        const delay = Math.min(i, 7) * 80;
        el.style.setProperty('--d', `${delay}ms`);
        reveal(el, delay + 1000);
      });
    });

    // Impact figures count up from zero, keeping any £, commas and + (e.g. "£982,999", "4,300+").
    watch('.stat-value', { threshold: 0.6 }, (els) => els.forEach((el) => {
      const m = /^(\D*)([\d,]+)(.*)$/.exec(el.textContent.trim());
      if (!m) return;
      const [, before, digits, after] = m;
      const target = Number(digits.replace(/,/g, ''));
      const commas = digits.includes(',');
      const start = performance.now();
      const duration = Math.min(1600, 600 + String(target).length * 120);
      const tick = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const n = Math.round(target * (1 - (1 - p) ** 3));
        el.textContent = before + (commas ? n.toLocaleString('en-GB') : n) + after;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }));

    // Journey stops pop in when the drawn line reaches them (both use a point 75% down the screen).
    watch('.stop', { rootMargin: '0px 0px -25% 0px' }, (els) => els.forEach((el) => reveal(el, 1000)));

    // Home timeline: the line draws across, then each dot and milestone in turn.
    watch('.timeline', { threshold: 0.3 }, (els) => els.forEach((el) => {
      const items = [...el.children];
      items.forEach((item, i) => item.style.setProperty('--i', i));
      reveal(el, items.length * 180 + 1300);
    }));

    // The dashed route line grows to follow the scroll position, and never shrinks back.
    const routes = [...document.querySelectorAll('.route')].map((el) => ({ el, p: 0 }));
    if (routes.length) {
      let queued = false;
      const draw = () => {
        queued = false;
        const mark = window.innerHeight * 0.75;
        for (const r of routes) {
          const rect = r.el.getBoundingClientRect();
          const p = Math.min(1, Math.max(0, (mark - rect.top - 30) / Math.max(1, rect.height - 60)));
          if (p > r.p) {
            r.p = p;
            r.el.style.setProperty('--p', p.toFixed(4));
          }
        }
      };
      const queue = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
      addEventListener('scroll', queue, { passive: true });
      addEventListener('resize', queue);
      draw();
    }
  }

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
        if (anim && match) {
          // Fade the list in afresh rather than letting it snap.
          el.classList.add('shown', 'settled', 'filter-in');
          el.style.setProperty('--d', `${Math.min(shown, 8) * 40}ms`);
          el.addEventListener('animationend', () => el.classList.remove('filter-in'), { once: true });
        }
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
    // Zoom the photo out of the tile that was clicked.
    const zoomFrom = (rect) => {
      img.style.opacity = '0';
      img.decode().catch(() => {}).then(() => {
        img.style.opacity = '';
        const to = img.getBoundingClientRect();
        if (!to.width || !to.height) return;
        img.animate([
          { transformOrigin: '0 0', transform: `translate(${rect.left - to.left}px, ${rect.top - to.top}px) scale(${rect.width / to.width}, ${rect.height / to.height})`, opacity: 0.5 },
          { transformOrigin: '0 0', transform: 'none', opacity: 1 },
        ], { duration: 380, easing: 'cubic-bezier(.2, .8, .2, 1)' });
      });
    };
    const step = (by) => {
      show(current + by);
      if (anim) img.animate([{ opacity: 0, translate: `${by * 24}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 260, easing: 'ease-out' });
    };
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lightbox]');
      if (!btn) return;
      show(visible().indexOf(btn));
      dialog.showModal();
      if (anim) zoomFrom(btn.getBoundingClientRect());
    });
    dialog.querySelector('.lb-prev').addEventListener('click', () => step(-1));
    dialog.querySelector('.lb-next').addEventListener('click', () => step(1));
    // Closing shrinks the photo back down onto its tile (the one now showing, after any next/previous) while the
    // backdrop fades. If that tile is scrolled out of view the photo just shrinks and fades.
    let closing = false;
    const shut = () => {
      if (!dialog.open || closing) return;
      if (!anim) { dialog.close(); return; }
      closing = true;
      img.getAnimations().forEach((a) => a.cancel());
      const from = img.getBoundingClientRect();
      const to = visible()[current]?.getBoundingClientRect();
      const onScreen = to && from.width && from.height && to.bottom > 0 && to.top < window.innerHeight;
      const frames = onScreen
        ? [
          { transformOrigin: '0 0', transform: 'none', opacity: 1 },
          { transformOrigin: '0 0', transform: `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`, opacity: 0.6 },
        ]
        : [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.85 }];
      dialog.classList.add('closing');
      const a = img.animate(frames, { duration: 340, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
      a.finished.catch(() => {}).then(() => {
        dialog.close();
        dialog.classList.remove('closing');
        a.cancel();
        closing = false;
      });
    };
    dialog.querySelector('.lb-close').addEventListener('click', shut);
    dialog.addEventListener('click', (e) => { if (e.target === dialog) shut(); });
    // Escape: animate instead of the browser's instant close.
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); shut(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
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
