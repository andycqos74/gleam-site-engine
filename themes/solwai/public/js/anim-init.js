// Runs in <head>, before the page is drawn: switches on the entrance animations (html.anim) so elements that are
// about to animate start hidden instead of flashing. Skipped in edit mode, when the visitor's device asks for reduced
// motion, and in browsers without IntersectionObserver. If solwai.js hasn't taken over within 3 seconds (blocked or
// failed to load) the animations are switched off again so nothing stays hidden.
(function () {
  var root = document.documentElement;
  if (root.classList.contains('is-editing') || !('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('anim');
  setTimeout(function () {
    if (!root.classList.contains('anim-ready')) root.classList.remove('anim');
  }, 3000);
})();
