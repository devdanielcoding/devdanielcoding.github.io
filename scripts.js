import { PROJECTS } from '../data/projects.js';

const toolsGrid = document.getElementById('tools-grid');
const gamesGrid = document.getElementById('games-grid');
const searchInput = document.getElementById('search');

function cardHTML({ id, title, desc, path, emoji, tags }) {
  const tagsHTML = (tags || []).map(t => `<span class="tag">${t}</span>`).join('');
  return `
    <article class="card tool">
      <span class="badge">#${id}</span>
      <h3>${title}</h3>
      <p>${desc}</p>
      <div class="tags">${tagsHTML}</div>
      <a href="${path}"><span class="emoji">${emoji}</span> Abrir</a>
    </article>
  `;
}

function render(list) {
  // Limpia contenedores
  toolsGrid.innerHTML = '';
  gamesGrid.innerHTML = '';

  // Pinta por categoría
  list.filter(p => p.category === 'tools')
      .forEach(p => toolsGrid.insertAdjacentHTML('beforeend', cardHTML(p)));

  list.filter(p => p.category === 'games')
      .forEach(p => gamesGrid.insertAdjacentHTML('beforeend', cardHTML(p)));
}

// Render inicial (orden opcional por id)
const sorted = [...PROJECTS].sort((a, b) => a.id.localeCompare(b.id));
render(sorted);

// Búsqueda en vivo sobre título, desc y tags
searchInput?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) return render(sorted);

  const filtered = sorted.filter(p => {
    const haystack = [
      p.id, p.title, p.desc, (p.tags || []).join(' ')
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  });

  render(filtered);
});
