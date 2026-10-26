// SolwAI theme motion. Everything here is decoration: the page is complete without it, and it only runs when
// anim-init.js switched animations on (not in edit mode, not with reduced motion).
//   [data-reveal]       rises into place when it scrolls into view
//   [data-stagger] > *  the same, one after another along a row of cards
//   [data-count]        a key figure counts up from zero to the number it shows (e.g. 83%, 7,175, 12% → 35%)
// At the end: the home page's contact form, which sends without leaving the page (it works as a plain form too).
(function () {
  var root = document.documentElement;
  if (!root.classList.contains('anim')) return;
  root.classList.add('anim-ready');

  // Stagger the children of each group by their position, so cards in a row arrive one after another.
  document.querySelectorAll('[data-stagger]').forEach(function (group) {
    Array.prototype.forEach.call(group.children, function (el, i) {
      el.style.setProperty('--d', Math.min(i, 6) * 80 + 'ms');
    });
  });

  // Once an element has settled, its hover effects take over again.
  function settle(el) {
    el.addEventListener('transitionend', function done(e) {
      if (e.target !== el || e.propertyName !== 'transform') return;
      el.removeEventListener('transitionend', done);
      el.classList.add('settled');
    });
  }

  var reveal = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      reveal.unobserve(entry.target);
      settle(entry.target);
      entry.target.classList.add('shown');
      entry.target.querySelectorAll('[data-count]').forEach(countUp);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal], [data-stagger] > *').forEach(function (el) { reveal.observe(el); });

  // Count every number in the figure up from zero together, keeping its separators, decimals and the words around
  // it, and finish on exactly the text the page was sent with.
  var NUM = /\d[\d,]*(?:\.\d+)?/g;
  function countUp(el) {
    var text = el.textContent;
    var parts = text.match(NUM);
    if (!parts || el.dataset.counted) return;
    el.dataset.counted = '1';
    var targets = parts.map(function (p) {
      var dec = (p.split('.')[1] || '').length;
      return { value: parseFloat(p.replace(/,/g, '')), dec: dec, commas: p.indexOf(',') > -1 };
    });
    var format = function (t, v) {
      var s = v.toFixed(t.dec);
      return t.commas ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : s;
    };
    var start = null;
    var duration = 1100;
    function frame(now) {
      if (start === null) start = now;
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var n = 0;
      el.textContent = p >= 1 ? text : text.replace(NUM, function () { var t = targets[n++]; return format(t, t.value * eased); });
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
})();

// Contact form: check it in the browser, then send it with fetch() and show the thanks in its place. If anything
// goes wrong on the way, fall back to a normal form post.
(function () {
  var form = document.querySelector('.contact-form');
  if (!form || document.body.classList.contains('is-editing')) return;
  var EMAIL = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-z]{2,}$/i;
  var NAMES = ['name', 'email', 'message'];
  var button = form.querySelector('button[type="submit"]');
  var label = button.textContent;

  function setError(name, message) {
    var input = form.elements[name];
    var old = input.parentNode.querySelector('.field-error');
    if (old) old.remove();
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    if (!message) return;
    var span = document.createElement('span');
    span.className = 'field-error';
    span.id = 'err-' + name;
    span.textContent = message;
    input.parentNode.appendChild(span);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', span.id);
  }
  function validate() {
    var errors = {};
    if (!form.elements.name.value.trim()) errors.name = 'Please tell us your name.';
    if (!EMAIL.test(form.elements.email.value.trim())) errors.email = 'Please enter a valid email address.';
    if (!form.elements.message.value.trim()) errors.message = 'Please write a message.';
    return errors;
  }
  function showErrors(errors) {
    NAMES.forEach(function (n) { setError(n, errors[n]); });
    var first = NAMES.filter(function (n) { return errors[n]; })[0];
    if (first) form.elements[first].focus();
  }
  NAMES.forEach(function (n) {
    // Recheck a flagged field as it's typed in, so its message is gone before the button is pressed (clearing it on
    // blur moves the button out from under the pointer mid-click).
    form.elements[n].addEventListener('input', function () {
      if (form.elements[n].getAttribute('aria-invalid')) setError(n, validate()[n]);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var errors = validate();
    if (Object.keys(errors).length) return showErrors(errors);
    button.disabled = true;
    button.textContent = 'Sending…';
    fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams(new FormData(form)) })
      .then(function (res) {
        return res.json().then(function (data) {
          if (res.ok) {
            var success = document.querySelector('.form-success');
            form.remove();
            success.hidden = false;
            success.tabIndex = -1;
            success.focus();
            return;
          }
          showErrors(data.errors || {});
          if (data.errors && data.errors.form) alert(data.errors.form);
          button.disabled = false;
          button.textContent = label;
        });
      })
      .catch(function () { form.submit(); });
  });
})();
