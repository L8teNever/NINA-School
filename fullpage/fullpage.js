// NINA School - Full Page Script (Complete Management)

let highlights = [];
let projects = [];
let activeProjectId = "proj_standard";
let sortMode = "newest";              // newest | oldest | manual
let includeDate = true;
let citationStyle = "de";
let searchQuery = "";
let globalSearch = false;
let isInternalUpdate = false;
let currentPage = 1;
const itemsPerPage = 10;
let dragId = null;

const CATEGORIES = [
  { key: "", label: "Keine" },
  { key: "definition", label: "Definition" },
  { key: "pro", label: "Pro" },
  { key: "contra", label: "Contra" },
  { key: "important", label: "Wichtig" }
];

const projectSelect = document.getElementById("project-select-full");
const addProjectBtn = document.getElementById("add-project-btn-full");
const deleteProjectBtn = document.getElementById("delete-project-btn-full");
const openSettingsBtnFull = document.getElementById("open-settings-btn-full");
const headerCount = document.getElementById("header-count");
const addNoteBtn = document.getElementById("add-note-btn");
const highlightsContainer = document.getElementById("highlights-container");
const emptyState = document.getElementById("empty-full");
const searchInput = document.getElementById("search-full");
const globalSearchToggle = document.getElementById("global-search");
const sortSelect = document.getElementById("sort-select");
const exportBtn = document.getElementById("export-markdown-btn");
const copyBibBtn = document.getElementById("copy-bib-btn");
const outlineBtn = document.getElementById("outline-btn");
const projectModal = document.getElementById("project-modal");
const projectNameInput = document.getElementById("project-name-input");
const modalCancel = document.getElementById("modal-cancel");
const modalSave = document.getElementById("modal-save");
const pagination = document.getElementById("pagination");
const prevPageBtn = document.getElementById("prev-page");
const nextPageBtn = document.getElementById("next-page");
const pageNumber = document.getElementById("page-number");
const pageStats = document.getElementById("page-stats");

function init() {
  chrome.storage.local.get({
    highlights: [],
    projects: [],
    activeProjectId: "",
    settings: {}
  }, (result) => {
    let migrated = false;

    let loadedProjects = result.projects || [];
    if (loadedProjects.length === 0) {
      loadedProjects = [{ id: "proj_standard", name: "Standard-Projekt" }];
      migrated = true;
    }
    projects = loadedProjects;

    let activeId = result.activeProjectId;
    if (!activeId) { activeId = "proj_standard"; migrated = true; }
    activeProjectId = activeId;

    let loadedHighlights = result.highlights || [];
    loadedHighlights.forEach(h => {
      if (!h.projectId) { h.projectId = "proj_standard"; migrated = true; }
      if (h.category === undefined) { h.category = ""; migrated = true; }
      if (!Array.isArray(h.tags)) { h.tags = []; migrated = true; }
      if (h.order === undefined) { h.order = h.timestamp || 0; migrated = true; }
    });
    highlights = loadedHighlights;

    const s = result.settings || {};
    if (s.includeDate !== undefined) includeDate = s.includeDate;
    if (s.citationStyle) citationStyle = s.citationStyle;
    if (s.sortMode) sortMode = s.sortMode;
    else if (s.sortDescending !== undefined) sortMode = s.sortDescending ? "newest" : "oldest";

    if (migrated) chrome.storage.local.set({ projects, activeProjectId, highlights });

    sortSelect.value = sortMode;
    renderProjectsDropdown();
    render();

    projectSelect.addEventListener("change", handleProjectChange);
    addProjectBtn.addEventListener("click", showProjectModal);
    deleteProjectBtn.addEventListener("click", deleteActiveProject);
    modalCancel.addEventListener("click", hideProjectModal);
    modalSave.addEventListener("click", saveNewProject);
    projectNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveNewProject();
      if (e.key === "Escape") hideProjectModal();
    });
    searchInput.addEventListener("input", handleSearch);
    globalSearchToggle.addEventListener("change", (e) => { globalSearch = e.target.checked; currentPage = 1; render(); });
    sortSelect.addEventListener("change", handleSortChange);
    addNoteBtn.addEventListener("click", addNoteCard);
    exportBtn.addEventListener("click", exportMarkdown);
    copyBibBtn.addEventListener("click", copyBibliography);
    outlineBtn.addEventListener("click", exportOutline);
    openSettingsBtnFull.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("fullpage/settings.html") });
    });
    prevPageBtn.addEventListener("click", goToPreviousPage);
    nextPageBtn.addEventListener("click", goToNextPage);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.highlights && !isInternalUpdate) highlights = changes.highlights.newValue || [];
      if (changes.projects) projects = changes.projects.newValue || [];
      if (changes.activeProjectId) activeProjectId = changes.activeProjectId.newValue || "proj_standard";
      if (changes.settings && changes.settings.newValue) {
        const ns = changes.settings.newValue;
        if (ns.includeDate !== undefined) includeDate = ns.includeDate;
        if (ns.citationStyle) citationStyle = ns.citationStyle;
        if (ns.sortMode) { sortMode = ns.sortMode; sortSelect.value = sortMode; }
      }
      renderProjectsDropdown();
      render();
    });
  });
}

function renderProjectsDropdown() {
  projectSelect.innerHTML = "";
  projects.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    option.selected = p.id === activeProjectId;
    projectSelect.appendChild(option);
  });
  const isStandard = activeProjectId === "proj_standard";
  deleteProjectBtn.style.opacity = isStandard ? "0.3" : "1";
  deleteProjectBtn.style.pointerEvents = isStandard ? "none" : "auto";
}

function handleProjectChange(e) {
  activeProjectId = e.target.value;
  currentPage = 1;
  chrome.storage.local.set({ activeProjectId }, () => render());
}

/* ===== Project modal ===== */
function showProjectModal() {
  projectModal.style.display = "flex";
  projectNameInput.value = "";
  projectNameInput.focus();
}
function hideProjectModal() {
  projectModal.style.display = "none";
  projectNameInput.value = "";
}
function saveNewProject() {
  const name = projectNameInput.value.trim();
  if (!name) { showToast("Bitte Projektnamen eingeben"); return; }
  const id = "proj_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  projects.push({ id, name });
  activeProjectId = id;
  currentPage = 1;
  chrome.storage.local.set({ projects, activeProjectId }, () => {
    renderProjectsDropdown();
    hideProjectModal();
    render();
    showToast(`Projekt „${name}" erstellt!`);
  });
}
function deleteActiveProject() {
  if (activeProjectId === "proj_standard") return;
  const projectToDelete = projects.find(p => p.id === activeProjectId);
  if (!projectToDelete) return;
  if (!confirm(`Projekt „${projectToDelete.name}" und alle Einträge wirklich löschen?`)) return;

  highlights = highlights.filter(h => h.projectId !== activeProjectId);
  projects = projects.filter(p => p.id !== activeProjectId);
  activeProjectId = "proj_standard";
  chrome.storage.local.set({ projects, activeProjectId, highlights }, () => {
    renderProjectsDropdown();
    render();
    showToast("Projekt gelöscht");
  });
}

/* ===== Idea / note card ===== */
function addNoteCard() {
  const id = "nina_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const ts = Date.now();
  highlights.push({
    id, type: "idea", text: "", note: "",
    title: "Eigene Notiz", url: "",
    timestamp: ts, projectId: activeProjectId,
    category: "", tags: [], order: ts
  });
  saveHighlights();
  searchQuery = ""; searchInput.value = "";
  render();
  const el = highlightsContainer.querySelector(`[data-id="${id}"] .idea-text`);
  if (el) { el.focus(); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
  showToast("Notiz hinzugefügt");
}

/* ===== Search / sort ===== */
function handleSearch(e) { searchQuery = e.target.value.toLowerCase().trim(); currentPage = 1; render(); }

function handleSortChange(e) {
  sortMode = e.target.value;
  chrome.storage.local.get({ settings: {} }, (result) => {
    const settings = { ...result.settings, sortMode };
    chrome.storage.local.set({ settings }, () => render());
  });
}

function goToPreviousPage() {
  if (currentPage > 1) { currentPage--; render(); highlightsContainer.scrollIntoView({ behavior: "smooth" }); }
}
function goToNextPage() {
  const total = getFiltered().length;
  const totalPages = Math.ceil(total / itemsPerPage);
  if (currentPage < totalPages) { currentPage++; render(); highlightsContainer.scrollIntoView({ behavior: "smooth" }); }
}

function getFiltered() {
  return highlights.filter(h => {
    if (!globalSearch && h.projectId !== activeProjectId) return false;
    if (!searchQuery) return true;
    const tagStr = (h.tags || []).join(" ");
    return [h.text, h.note, h.title, h.fileName, h.author, tagStr]
      .some(v => v && v.toLowerCase().includes(searchQuery));
  });
}

function sortFiltered(list) {
  const arr = [...list];
  if (sortMode === "manual") arr.sort((a, b) => (a.order || 0) - (b.order || 0));
  else if (sortMode === "oldest") arr.sort((a, b) => a.timestamp - b.timestamp);
  else arr.sort((a, b) => b.timestamp - a.timestamp);
  return arr;
}

/* ===== Render ===== */
function render() {
  const filtered = sortFiltered(getFiltered());

  if (headerCount) {
    const totalInProject = highlights.filter(h => h.projectId === activeProjectId).length;
    if (globalSearch) headerCount.textContent = `${filtered.length} (alle Projekte)`;
    else if (searchQuery) headerCount.textContent = `${filtered.length} von ${totalInProject}`;
    else headerCount.textContent = totalInProject === 1 ? "1 Eintrag" : `${totalInProject} Einträge`;
  }

  if (filtered.length === 0) {
    highlightsContainer.style.display = "none";
    pagination.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }
  highlightsContainer.style.display = "grid";
  emptyState.style.display = "none";

  // Manual mode shows everything (so drag-ordering is consistent); else paginate.
  let pageItems, startIndex = 0, endIndex = filtered.length, totalPages = 1;
  if (sortMode === "manual") {
    pageItems = filtered;
    pagination.style.display = "none";
  } else {
    totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    startIndex = (currentPage - 1) * itemsPerPage;
    endIndex = startIndex + itemsPerPage;
    pageItems = filtered.slice(startIndex, endIndex);
    pagination.style.display = filtered.length > itemsPerPage ? "flex" : "none";
    pageNumber.textContent = `Seite ${currentPage}`;
    pageStats.textContent = `${startIndex + 1}–${Math.min(endIndex, filtered.length)} von ${filtered.length}`;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  highlightsContainer.innerHTML = "";
  pageItems.forEach(h => highlightsContainer.appendChild(buildCard(h)));
}

function buildCard(h) {
  const card = document.createElement("div");
  card.className = "highlight-card-full";
  card.setAttribute("data-id", h.id);

  if (h.type === "idea") card.classList.add("idea-card");
  if (sortMode === "manual") { card.classList.add("draggable"); card.draggable = true; }

  if (h.type === "idea") {
    card.innerHTML = `
      <div class="idea-badge">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
        Eigene Notiz
      </div>
      <textarea class="idea-text" data-id="${h.id}" placeholder="Eigener Gedanke, Gliederungspunkt, Argument…">${escapeHtml(h.text || "")}</textarea>
      ${categoryRow(h)}
      ${tagsBlock(h)}
      <div class="card-actions">
        <button class="card-action-btn copy" data-id="${h.id}">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          Kopieren
        </button>
        <button class="card-action-btn delete" data-id="${h.id}">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Löschen
        </button>
      </div>`;
    wireIdeaCard(card, h);
    return card;
  }

  let cardContent = "";
  if (h.type === "image") {
    cardContent = `<div class="card-image-container"><img src="${escapeHtml(h.imageUrl)}" class="card-image-preview" alt="Bildquelle"></div>`;
  } else if (h.type === "file") {
    cardContent = `
      <div class="card-file-container">
        <div class="file-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg></div>
        <div class="file-details">
          <div class="file-name" title="${escapeHtml(h.fileName)}">${escapeHtml(h.fileName)}</div>
          <div class="file-size">${formatBytes(h.fileSize)}</div>
        </div>
      </div>`;
  } else {
    cardContent = `<div class="card-text">${escapeHtml(h.text)}</div>`;
  }

  const isLocalFile = h.url && h.url.startsWith("Lokal:");
  const yearVal = displayYear(h);

  card.innerHTML = `
    <div class="card-header">
      <div class="card-source">
        <div class="card-domain">${escapeHtml(getWebsiteName(h.url))}</div>
        <div class="card-source-title">${escapeHtml(h.title || "Unbenannte Seite")}</div>
      </div>
      <div class="card-date">${formatDate(h.timestamp)}</div>
    </div>

    ${cardContent}

    ${isLocalFile ? "" : `
    <div class="card-meta-row">
      <input class="card-meta-input meta-author" data-id="${h.id}" placeholder="Autor" value="${escapeHtml(h.author || "")}">
      <input class="card-meta-input meta-year" data-id="${h.id}" placeholder="Jahr (z.B. 2023)" value="${escapeHtml(yearVal)}">
    </div>`}

    ${categoryRow(h)}
    ${tagsBlock(h)}

    <textarea class="card-note" data-id="${h.id}" placeholder="Notiz hinzufügen…">${escapeHtml(h.note || "")}</textarea>

    <div class="card-actions">
      ${isLocalFile ? "" : `
        <a href="${escapeHtml(jumpUrl(h))}" target="_blank" class="card-action-btn" title="Quelle öffnen & zur Stelle springen">
          <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          Zur Stelle
        </a>`}
      <button class="card-action-btn cite" data-id="${h.id}" title="Kurzbeleg für den Fließtext kopieren">
        <svg viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z"/></svg>
        Beleg
      </button>
      <button class="card-action-btn copy" data-id="${h.id}">
        <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
        Kopieren
      </button>
      <button class="card-action-btn delete" data-id="${h.id}">
        <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        Löschen
      </button>
    </div>`;

  wireSourceCard(card, h);
  return card;
}

function categoryRow(h) {
  const chips = CATEGORIES.map(c =>
    `<button class="cat-chip${(h.category || "") === c.key ? " active" : ""}" data-cat="${c.key}" data-id="${h.id}">${c.label}</button>`
  ).join("");
  return `<div class="cat-row">${chips}</div>`;
}

function tagsBlock(h) {
  const chips = (h.tags || []).length
    ? `<div class="card-tag-chips">${h.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join("")}</div>`
    : "";
  return `${chips}<input class="card-tags-input" data-id="${h.id}" placeholder="Tags (mit Komma getrennt)" value="${escapeHtml((h.tags || []).join(", "))}">`;
}

/* ===== Card wiring ===== */
function wireCommon(card, h) {
  // Category chips
  card.querySelectorAll(".cat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      updateHighlight(h.id, item => { item.category = chip.getAttribute("data-cat"); });
      card.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });
  // Tags
  const tagsInput = card.querySelector(".card-tags-input");
  if (tagsInput) {
    tagsInput.addEventListener("change", () => {
      const tags = parseTags(tagsInput.value);
      updateHighlight(h.id, item => { item.tags = tags; });
      render();
    });
  }
  // Drag
  if (sortMode === "manual") attachDrag(card, h);
  // Delete
  card.querySelector(".delete").addEventListener("click", () => {
    highlights = highlights.filter(x => x.id !== h.id);
    saveHighlights();
    render();
    showToast("Eintrag gelöscht");
  });
}

function wireIdeaCard(card, h) {
  const ta = card.querySelector(".idea-text");
  ta.addEventListener("input", () => updateHighlight(h.id, item => { item.text = ta.value; }));
  card.querySelector(".copy").addEventListener("click", () => {
    navigator.clipboard.writeText(h.text || "").then(() => showToast("Kopiert!"));
  });
  wireCommon(card, h);
}

function wireSourceCard(card, h) {
  const noteTa = card.querySelector(".card-note");
  noteTa.addEventListener("input", () => updateHighlight(h.id, item => { item.note = noteTa.value; }));

  const author = card.querySelector(".meta-author");
  if (author) author.addEventListener("change", () => updateHighlight(h.id, item => { item.author = author.value.trim(); }));
  const yearInput = card.querySelector(".meta-year");
  if (yearInput) yearInput.addEventListener("change", () => updateHighlight(h.id, item => { item.publishedDate = yearInput.value.trim(); }));

  const citeBtn = card.querySelector(".cite");
  if (citeBtn) citeBtn.addEventListener("click", () => {
    const text = NinaCite.formatInText(h, citationStyle);
    navigator.clipboard.writeText(text).then(() => showToast("Beleg kopiert!"));
  });

  card.querySelector(".copy").addEventListener("click", () => {
    const ref = NinaCite.formatReference(h, citationStyle, includeDate);
    let text;
    if (h.type === "image") text = `[Bildquelle]\n${ref}`;
    else if (h.type === "file") text = `[Datei] ${h.fileName} (${formatBytes(h.fileSize)})`;
    else text = `„${h.text}"\n\n${ref}`;
    if (h.note) text += `\nNotiz: ${h.note}`;
    navigator.clipboard.writeText(text).then(() => showToast("Kopiert!"));
  });

  wireCommon(card, h);
}

/* ===== Drag reorder ===== */
function attachDrag(card, h) {
  card.addEventListener("dragstart", (e) => {
    dragId = h.id;
    card.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  card.addEventListener("dragend", () => {
    dragId = null;
    card.classList.remove("dragging");
    document.querySelectorAll(".drop-target").forEach(c => c.classList.remove("drop-target"));
  });
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (dragId && dragId !== h.id) card.classList.add("drop-target");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drop-target"));
  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("drop-target");
    if (dragId && dragId !== h.id) reorder(dragId, h.id);
  });
}

function reorder(fromId, toId) {
  // Reorder within the currently displayed (project-scoped) list.
  const list = sortFiltered(getFiltered());
  const fromIdx = list.findIndex(x => x.id === fromId);
  const toIdx = list.findIndex(x => x.id === toId);
  if (fromIdx === -1 || toIdx === -1) return;
  const [moved] = list.splice(fromIdx, 1);
  list.splice(toIdx, 0, moved);
  // Reassign sequential order values
  list.forEach((item, i) => {
    const ref = highlights.find(x => x.id === item.id);
    if (ref) ref.order = i;
  });
  saveHighlights();
  render();
}

function updateHighlight(id, mutator) {
  const idx = highlights.findIndex(x => x.id === id);
  if (idx === -1) return;
  mutator(highlights[idx]);
  saveHighlights();
}

function saveHighlights() {
  isInternalUpdate = true;
  chrome.storage.local.set({ highlights }, () => {
    setTimeout(() => { isInternalUpdate = false; }, 150);
  });
}

/* ===== Helpers ===== */
function parseTags(value) {
  const seen = new Set();
  return value.split(",").map(t => t.trim()).filter(t => {
    if (!t || seen.has(t.toLowerCase())) return false;
    seen.add(t.toLowerCase());
    return true;
  });
}

function displayYear(h) {
  if (!h.publishedDate) return "";
  const d = new Date(h.publishedDate);
  return isNaN(d.getTime()) ? h.publishedDate : String(d.getFullYear());
}

function jumpUrl(h) {
  if (!h.url || h.url.startsWith("Lokal:")) return h.url || "#";
  const base = h.url.split("#")[0];
  return `${base}#nina=${encodeURIComponent(h.id)}`;
}

function getWebsiteName(urlString) {
  if (urlString && urlString.startsWith("Lokal:")) return "Lokale Datei";
  try {
    const url = new URL(urlString);
    let host = url.hostname.replace("www.", "");
    let parts = host.split('.');
    if (parts.length > 1) {
      if (['de', 'en', 'support', 'm'].includes(parts[0])) return cap(parts[1]);
      return cap(parts[0]);
    }
    return host;
  } catch (e) { return "Webseite"; }
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString("de-DE", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

/* ===== Export ===== */
function projectEntries() {
  return highlights.filter(h => h.projectId === activeProjectId);
}
function projectName() {
  const p = projects.find(p => p.id === activeProjectId);
  return p ? p.name : "Quellensammlung";
}

function exportMarkdown() {
  const entries = projectEntries();
  if (entries.length === 0) { showToast("Keine Einträge zum Exportieren"); return; }

  const name = projectName();
  let md = `# NINA School – ${name}\n`;
  md += `Generiert am ${new Date().toLocaleDateString("de-DE")} · ${entries.length} Einträge · Zitierstil: ${NinaCite.STYLES[citationStyle]}\n\n---\n\n`;

  const sorted = sortFiltered(entries);
  sorted.forEach((h, i) => {
    if (h.type === "idea") {
      md += `### 💡 Notiz ${i + 1}\n\n${h.text || ""}\n\n`;
    } else {
      const kind = h.type === "image" ? "Bild" : h.type === "file" ? "Datei" : "Zitat";
      md += `### ${kind} ${i + 1}: ${h.title || "Unbenannte Seite"}\n\n`;
      if (h.type === "image") md += `![Bildquelle](${h.imageUrl})\n\n`;
      else if (h.type === "file") md += `* **Datei:** ${h.fileName} (${formatBytes(h.fileSize)})\n`;
      else md += `> ${h.text}\n\n`;
      const ref = NinaCite.formatReference(h, citationStyle, includeDate);
      if (ref) md += `* **Quelle (${NinaCite.STYLES[citationStyle]}):** ${ref}\n`;
    }
    if ((h.tags || []).length) md += `* **Tags:** ${h.tags.map(t => "#" + t).join(", ")}\n`;
    if (h.note) md += `* **Notiz:** ${h.note}\n`;
    md += `\n---\n\n`;
  });

  downloadFile(md, `NINA_${name.replace(/\s+/g, "_")}.md`, "text/markdown");
  showToast("Markdown exportiert!");
}

function copyBibliography() {
  const refs = projectEntries()
    .filter(h => h.type !== "idea")
    .map(h => NinaCite.formatReference(h, citationStyle, includeDate))
    .filter(Boolean)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  if (refs.length === 0) { showToast("Keine Quellen vorhanden"); return; }

  let out = `Quellenverzeichnis – ${projectName()} (${NinaCite.STYLES[citationStyle]})\n\n`;
  out += refs.map(r => `- ${r}`).join("\n");
  navigator.clipboard.writeText(out).then(() => showToast("Quellenverzeichnis kopiert!"));
}

function exportOutline() {
  const entries = sortFiltered(projectEntries());
  if (entries.length === 0) { showToast("Keine Einträge"); return; }

  const name = projectName();
  let out = `GLIEDERUNG – ${name}\n${"=".repeat(40)}\n\n`;
  entries.forEach((h, i) => {
    if (h.type === "idea") {
      out += `■ ${h.text || "(leere Notiz)"}\n\n`;
    } else if (h.type === "image") {
      out += `${i + 1}. [Bild] ${h.title || ""}\n`;
    } else if (h.type === "file") {
      out += `${i + 1}. [Datei] ${h.fileName}\n`;
    } else {
      out += `${i + 1}. „${h.text}"\n`;
      const inText = NinaCite.formatInText(h, citationStyle);
      if (inText) out += `   Beleg: ${inText}\n`;
    }
    if (h.note) out += `   → ${h.note}\n`;
    out += `\n`;
  });

  downloadFile(out, `NINA_Gliederung_${name.replace(/\s+/g, "_")}.txt`, "text/plain");
  showToast("Gliederung exportiert!");
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showToast(message) {
  const existing = document.querySelector(".toast-msg");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast-msg";
  toast.textContent = message;
  document.body.appendChild(toast);
  toast.offsetHeight;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 2200);
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener("DOMContentLoaded", init);
