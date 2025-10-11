document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('tool-search');
  const grid = document.getElementById('tool-grid');
  if (!input || !grid) return;

  const cards = Array.from(grid.querySelectorAll('.tool'));

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    cards.forEach((card) => {
      const text = card.textContent?.toLowerCase() ?? '';
      card.classList.toggle('hide', Boolean(query) && !text.includes(query));
    });
  });
});
