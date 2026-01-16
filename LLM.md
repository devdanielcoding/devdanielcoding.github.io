# LLM CONTEXT — devdanielcoding.github.io

## 1. Repository Purpose
This repository powers a personal GitHub Pages website that aggregates:
- Small web tools
- Experiments
- Games
- Data Science demos

The site is fully static and client-side rendered.

URL: https://devdanielcoding.github.io/

The repository itself is the single source of truth for the website.

---

## 2. Deployment Model
- Hosted via GitHub Pages
- Branch: main
- No build step
- No backend
- No server-side rendering

Any change pushed to `main` affects production.

---

## 3. Tech Stack
- HTML
- CSS (vanilla)
- JavaScript (vanilla)
- No frameworks
- No bundlers
- No transpilers

All logic runs in the browser.

---

## 4. High-Level Architecture
The site consists of:
- A central home page that renders sections dynamically
- Independent tools, each living in its own folder
- Data-driven rendering via JavaScript objects

---

## 5. Root Structure (IMPORTANT)

/  
├── index.html        # Home page entry point  
├── scripts.js        # Main rendering logic for home  
├── styles.css        # Global styles  
├── data/  
│   └── projects.js   # Source of truth for projects/tools metadata  
├── tools/            # Collection of independent tools  
├── games/            # Simple browser games  
├── data-science/     # Data science demos  
└── README.md         # Human-facing documentation  

---

## 6. Source of Truth: data/projects.js

`data/projects.js` defines all cards rendered on the home page.

Each entry includes:
- title
- description
- path (relative URL)
- tags
- category (tools, games, data-science, etc.)

Rendering logic MUST NOT hardcode project data elsewhere.

---

## 7. Tools Folder Convention

Each tool lives in its own folder:

/tools/<tool-name>/

Typical structure:
- index.html
- styles.css (optional)
- script.js (optional)
- assets/ (optional)

Tools are:
- Fully independent
- Self-contained
- Linked from the home page via `data/projects.js`

---

## 8. PDFs and Assets

PDF files:
- Have intuitive, descriptive filenames
- The filename itself describes the content
- No external index is required to understand them

Never rename PDFs without updating references if they are linked.

---

## 9. Rendering Logic (Home)

- `index.html` provides static layout + containers
- `scripts.js`:
  - Imports data from `data/projects.js`
  - Groups projects by category
  - Renders cards dynamically
  - Handles simple filtering or grouping

Rendering is intentionally simple and readable.

---

## 10. Design Principles
- Simplicity over abstraction
- Readability over cleverness
- Explicit logic preferred over DRY
- No premature optimization

---

## 11. Constraints (STRICT)
- DO NOT introduce frameworks (React, Vue, etc.)
- DO NOT add build steps
- DO NOT add backend dependencies
- DO NOT refactor structure without strong reason
- DO NOT move files casually (paths matter for GitHub Pages)

---

## 12. Typical Tasks You May Be Asked
- Add a new tool
- Add a new card to the home page
- Modify `data/projects.js`
- Improve UI styles without changing logic
- Refactor JavaScript for clarity
- Keep everything static

---

## 13. Non-Goals
- Authentication
- User accounts
- Databases
- APIs
- SEO optimization
- Performance micro-optimizations

---

## 14. How to Work on This Repo (LLM Instructions)
- Read this file first
- Treat `data/projects.js` as authoritative
- Follow existing patterns strictly
- Prefer minimal, explicit changes
- Avoid introducing new concepts unless requested
