// Admin pages: ask before destructive form posts (forms with data-confirm).
document.addEventListener('submit', (e) => {
  const message = e.target.dataset.confirm;
  if (message && !confirm(message)) e.preventDefault();
});
