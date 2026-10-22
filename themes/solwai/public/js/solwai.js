// SolwAI theme motion. Everything here is decoration: the page is complete without it, and it only runs when
// anim-init.js switched animations on (not in edit mode, not with reduced motion).
//   [data-reveal]       rises into place when it scrolls into view
//   [data-stagger] > *  the same, one after another along a row of cards
//   [data-count]        a key figure counts up from zero to the number it shows (e.g. 83%, 7,175, 12% → 35%)
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
