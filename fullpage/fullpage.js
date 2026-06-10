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

const projectBtn = document.getElementById("project-btn");
const projectMenu = document.getElementById("project-menu");
const projectList = document.getElementById("project-list");
const projectBtnName = document.getElementById("project-btn-name");
const projectBtnMeta = document.getElementById("project-btn-meta");
const deadlineChip = document.getElementById("deadline-chip");
const moreBtn = document.getElementById("more-btn");
const moreMenu = document.getElementById("more-menu");
const addProjectBtn = document.getElementById("add-project-btn-full");
const deleteProjectBtn = document.getElementById("delete-project-btn-full");
const openSettingsBtnFull = document.getElementById("open-settings-btn-full");
const headerCount = projectBtnMeta;
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
const projectDeadlineInput = document.getElementById("project-deadline");
const deadlineInfo = document.getElementById("deadline-info");
const statsBtn = document.getElementById("stats-btn");
const statsModal = document.getElementById("stats-modal");
const statsClose = document.getElementById("stats-close");
const statsBody = document.getElementById("stats-body");
const statsTitle = document.getElementById("stats-title");
const shortcutsBtn = document.getElementById("shortcuts-btn");
const shortcutsModal = document.getElementById("shortcuts-modal");
const shortcutsClose = document.getElementById("shortcuts-close");

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

    projectBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePopover(projectMenu); });
    moreBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePopover(moreMenu); });
    document.addEventListener("click", (e) => {
      if (e.target.closest && e.target.closest(".popover-item")) { closePopovers(); return; }
      if (!projectMenu.contains(e.target)) projectMenu.setAttribute("hidden", "");
      if (!moreMenu.contains(e.target)) moreMenu.setAttribute("hidden", "");
    });
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
    projectDeadlineInput.addEventListener("change", setDeadline);
    statsBtn.addEventListener("click", showStats);
    statsClose.addEventListener("click", () => { statsModal.style.display = "none"; });
    statsModal.addEventListener("click", (e) => { if (e.target === statsModal) statsModal.style.display = "none"; });
    shortcutsBtn.addEventListener("click", () => toggleShortcuts(true));
    shortcutsClose.addEventListener("click", () => toggleShortcuts(false));
    shortcutsModal.addEventListener("click", (e) => { if (e.target === shortcutsModal) toggleShortcuts(false); });
    document.addEventListener("keydown", handleShortcut);

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
  const active = projects.find(p => p.id === activeProjectId);
  projectBtnName.textContent = active ? active.name : "Projekt";

  projectList.innerHTML = "";
  projects.forEach(p => {
    const cnt = highlights.filter(h => h.projectId === p.id).length;
    const btn = document.createElement("button");
    btn.className = "project-list-item" + (p.id === activeProjectId ? " active" : "");
    btn.innerHTML = `
      <span class="pli-check">${p.id === activeProjectId ? "✓" : ""}</span>
      <span class="pli-name">${escapeHtml(p.name)}</span>
      <span class="pli-count">${cnt}</span>`;
    btn.addEventListener("click", () => switchProject(p.id));
    projectList.appendChild(btn);
  });

  const isStandard = activeProjectId === "proj_standard";
  deleteProjectBtn.style.opacity = isStandard ? "0.4" : "1";
  deleteProjectBtn.style.pointerEvents = isStandard ? "none" : "auto";
  renderDeadline();
}

function switchProject(id) {
  closePopovers();
  if (id === activeProjectId) return;
  activeProjectId = id;
  currentPage = 1;
  chrome.storage.local.set({ activeProjectId }, () => { renderProjectsDropdown(); render(); });
}

function togglePopover(el) {
  const opening = el.hasAttribute("hidden");
  closePopovers();
  if (opening) el.removeAttribute("hidden");
}
function closePopovers() {
  projectMenu.setAttribute("hidden", "");
  moreMenu.setAttribute("hidden", "");
}

/* ===== Project deadline ===== */
function daysUntil(dateStr) {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function renderDeadline() {
  const p = projects.find(p => p.id === activeProjectId);
  const d = (p && p.deadline) ? p.deadline : "";
  projectDeadlineInput.value = d;
  if (!d) {
    deadlineInfo.textContent = "";
    deadlineInfo.className = "deadline-info";
    deadlineChip.setAttribute("hidden", "");
    return;
  }
  const days = daysUntil(d);
  let txt, cls = "";
  if (days > 1) { txt = `noch ${days} Tage`; if (days <= 3) cls = "soon"; }
  else if (days === 1) { txt = "noch 1 Tag"; cls = "soon"; }
  else if (days === 0) { txt = "heute fällig"; cls = "soon"; }
  else { txt = `${Math.abs(days)} Tage überfällig`; cls = "over"; }
  deadlineInfo.textContent = "📅 " + txt;
  deadlineInfo.className = "deadline-info " + cls;
  // Also surface it as a small chip in the bar (relevant at a glance)
  deadlineChip.textContent = "📅 " + txt;
  deadlineChip.className = "deadline-chip " + cls;
  deadlineChip.removeAttribute("hidden");
}

function setDeadline() {
  const p = projects.find(p => p.id === activeProjectId);
  if (!p) return;
  p.deadline = projectDeadlineInput.value || "";
  chrome.storage.local.set({ projects }, () => { renderDeadline(); showToast("Deadline gespeichert"); });
}

/* ===== Project modal ===== */
function showProjectModal() {
  closePopovers();
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
  // Pinned entries float to the top (keeping their relative order)
  return [...arr.filter(x => x.pinned), ...arr.filter(x => !x.pinned)];
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

const ICONS = {
  pin: '<svg viewBox="0 0 24 24"><path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"/></svg>',
  jump: '<svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
  cite: '<svg viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  caret: '<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>'
};

function headerPin(h) {
  return `<button class="iact pin${h.pinned ? " active" : ""}" data-id="${h.id}" title="${h.pinned ? "Anheften lösen" : "Anheften"}">${ICONS.pin}</button>`;
}

function typeBadge(h) {
  const map = { image: "Bild", file: "Datei", page: "Seite" };
  return map[h.type] ? `<span class="type-badge">${map[h.type]}</span>` : "";
}

function cardToolbar(h, mainButtons) {
  return `<div class="card-toolbar">
    <div class="toolbar-main">${mainButtons}</div>
    <div class="toolbar-right">
      <button class="iact toggle-details" title="Details ein-/ausblenden">${ICONS.caret}</button>
      <button class="iact danger delete" data-id="${h.id}" title="Löschen">${ICONS.trash}</button>
    </div>
  </div>`;
}

function buildCard(h) {
  const card = document.createElement("div");
  card.className = "hl-card";
  card.setAttribute("data-id", h.id);
  card.setAttribute("data-cat", h.category || "");

  if (h.type === "idea") card.classList.add("idea-card");
  if (sortMode === "manual") { card.classList.add("draggable"); card.draggable = true; }

  if (h.type === "idea") {
    card.innerHTML = `
      <span class="cat-stripe"></span>
      <div class="card-top">
        <div class="idea-badge">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
          Eigene Notiz
        </div>
        <div class="card-top-right">${headerPin(h)}</div>
      </div>
      <textarea class="idea-text" data-id="${h.id}" placeholder="Eigener Gedanke, Gliederungspunkt, Argument…">${escapeHtml(h.text || "")}</textarea>
      ${categoryRow(h)}
      ${tagsChips(h)}
      ${cardToolbar(h, `<button class="act copy" data-id="${h.id}">${ICONS.copy}Kopieren</button>`)}
      <div class="card-details" hidden>
        ${tagsInput(h)}
        ${moveRow(h)}
      </div>`;
    wireIdeaCard(card, h);
    return card;
  }

  if (h.type === "pagenote") {
    const mb = `
      <a href="${escapeHtml(jumpUrl(h))}" target="_blank" class="act" title="Seite öffnen">${ICONS.jump}Seite öffnen</a>
      <button class="act copy" data-id="${h.id}" title="Kopieren">${ICONS.copy}Kopieren</button>`;
    card.innerHTML = `
      <span class="cat-stripe"></span>
      <div class="card-top">
        <div class="card-source">
          <div class="card-domain">${escapeHtml(getWebsiteName(h.url))}<span class="type-badge">Seiten-Notiz</span></div>
          <div class="card-source-title">${escapeHtml(h.title || "Seite")}</div>
        </div>
        <div class="card-top-right"><span class="card-date">${formatDate(h.timestamp)}</span>${headerPin(h)}</div>
      </div>
      <textarea class="card-note" data-id="${h.id}" placeholder="Notiz zu dieser Seite…">${escapeHtml(h.note || "")}</textarea>
      ${categoryRow(h)}
      ${tagsChips(h)}
      ${cardToolbar(h, mb)}
      <div class="card-details" hidden>${tagsInput(h)}${moveRow(h)}</div>`;
    wireSourceCard(card, h);
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
  } else if (h.type === "page") {
    cardContent = `<div class="card-page-note">
      <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
      Ganze Seite als Quelle gemerkt
    </div>`;
  } else {
    cardContent = `<div class="card-text">${escapeHtml(h.text)}</div>`;
  }

  const isLocalFile = h.url && h.url.startsWith("Lokal:");
  const isText = !h.type;
  const yearVal = displayYear(h);

  const mainButtons = `
    ${isLocalFile ? "" : `<a href="${escapeHtml(jumpUrl(h))}" target="_blank" class="act" title="Quelle öffnen & zur Stelle springen">${ICONS.jump}Zur Stelle</a>`}
    <button class="act cite" data-id="${h.id}" title="Kurzbeleg für den Fließtext kopieren">${ICONS.cite}Beleg</button>
    <button class="act copy" data-id="${h.id}" title="Mit Quellenangabe kopieren">${ICONS.copy}Kopieren</button>`;

  const detailsInner = isLocalFile
    ? `${tagsInput(h)}${moveRow(h)}`
    : `
      ${isText ? quoteTypeRow(h) : ""}
      <div class="card-meta-row">
        <input class="card-meta-input meta-author" data-id="${h.id}" placeholder="Autor" value="${escapeHtml(h.author || "")}">
        <input class="card-meta-input meta-year" data-id="${h.id}" placeholder="Jahr (z.B. 2023)" value="${escapeHtml(yearVal)}">
      </div>
      <div class="card-meta-row">
        <input class="card-meta-input meta-page" data-id="${h.id}" placeholder="Seite / Abschnitt" value="${escapeHtml(h.page || "")}">
        <select class="card-meta-input meta-srctype" data-id="${h.id}">${sourceTypeOptions(h.sourceType)}</select>
      </div>
      ${tagsInput(h)}
      ${moveRow(h)}`;

  card.innerHTML = `
    <span class="cat-stripe"></span>
    <div class="card-top">
      <div class="card-source">
        <div class="card-domain">${escapeHtml(getWebsiteName(h.url))}${typeBadge(h)}</div>
        <div class="card-source-title">${escapeHtml(h.title || "Unbenannte Seite")}</div>
      </div>
      <div class="card-top-right">
        <span class="card-date">${formatDate(h.timestamp)}</span>
        ${headerPin(h)}
      </div>
    </div>

    ${cardContent}
    ${categoryRow(h)}
    ${tagsChips(h)}

    <textarea class="card-note" data-id="${h.id}" placeholder="Notiz hinzufügen…">${escapeHtml(h.note || "")}</textarea>

    ${cardToolbar(h, mainButtons)}

    <div class="card-details" hidden>${detailsInner}</div>`;

  wireSourceCard(card, h);
  return card;
}

const SOURCE_TYPES = [
  { key: "website", label: "Website" },
  { key: "book", label: "Buch" },
  { key: "news", label: "Zeitung/Artikel" },
  { key: "journal", label: "Wissenschaftlich" }
];

function quoteTypeRow(h) {
  const para = h.quoteType === "paraphrase";
  return `<div class="qt-row">
    <button class="qt-chip${para ? "" : " active"}" data-qt="direct" data-id="${h.id}" title="Wörtliches Zitat">„ " Direktzitat</button>
    <button class="qt-chip${para ? " active" : ""}" data-qt="paraphrase" data-id="${h.id}" title="Sinngemäß (vgl.)">vgl. Paraphrase</button>
  </div>`;
}

function sourceTypeOptions(current) {
  return SOURCE_TYPES.map(t =>
    `<option value="${t.key}"${(current || "website") === t.key ? " selected" : ""}>${t.label}</option>`
  ).join("");
}


function moveRow(h) {
  if (projects.length <= 1) return "";
  const opts = projects.map(p =>
    `<option value="${p.id}"${p.id === h.projectId ? " selected" : ""}>${escapeHtml(p.name)}</option>`
  ).join("");
  return `<div class="card-move-row"><span>Verschieben:</span><select class="card-move-select" data-id="${h.id}">${opts}</select></div>`;
}

function categoryRow(h) {
  const chips = CATEGORIES.map(c =>
    `<button class="cat-chip${(h.category || "") === c.key ? " active" : ""}" data-cat="${c.key}" data-id="${h.id}">${c.label}</button>`
  ).join("");
  return `<div class="cat-row">${chips}</div>`;
}

function tagsChips(h) {
  if (!(h.tags || []).length) return "";
  return `<div class="card-tag-chips">${h.tags.map(t => `<span class="tag-chip">#${escapeHtml(t)}</span>`).join("")}</div>`;
}

function tagsInput(h) {
  return `<input class="card-tags-input" data-id="${h.id}" placeholder="Tags (mit Komma getrennt)" value="${escapeHtml((h.tags || []).join(", "))}">`;
}

/* ===== Card wiring ===== */
function wireCommon(card, h) {
  // Details toggle (progressive disclosure)
  const toggle = card.querySelector(".toggle-details");
  if (toggle) toggle.addEventListener("click", () => {
    const d = card.querySelector(".card-details");
    if (d.hasAttribute("hidden")) { d.removeAttribute("hidden"); card.classList.add("expanded"); }
    else { d.setAttribute("hidden", ""); card.classList.remove("expanded"); }
  });

  // Category chips
  card.querySelectorAll(".cat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const key = chip.getAttribute("data-cat");
      updateHighlight(h.id, item => { item.category = key; });
      card.querySelectorAll(".cat-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      card.dataset.cat = key;   // recolour the stripe instantly
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
  // Pin / favourite
  const pin = card.querySelector(".pin");
  if (pin) pin.addEventListener("click", () => {
    updateHighlight(h.id, item => { item.pinned = !item.pinned; });
    render();
  });
  // Move to another project
  const moveSel = card.querySelector(".card-move-select");
  if (moveSel) moveSel.addEventListener("change", () => {
    const target = moveSel.value;
    if (target === h.projectId) return;
    const name = (projects.find(p => p.id === target) || {}).name || "Projekt";
    updateHighlight(h.id, item => { item.projectId = target; });
    render();
    showToast(`Verschoben nach „${name}"`);
  });
  // Drag
  if (sortMode === "manual") attachDrag(card, h);
  // Delete (with undo)
  card.querySelector(".delete").addEventListener("click", () => deleteHighlight(h));
}

function deleteHighlight(h) {
  highlights = highlights.filter(x => x.id !== h.id);
  saveHighlights();
  render();
  showUndoToast("Eintrag gelöscht", () => {
    if (!highlights.some(x => x.id === h.id)) {
      highlights.push(h);
      saveHighlights();
      render();
      showToast("Wiederhergestellt");
    }
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
  const pageInput = card.querySelector(".meta-page");
  if (pageInput) pageInput.addEventListener("change", () => updateHighlight(h.id, item => { item.page = pageInput.value.trim(); }));
  const srcType = card.querySelector(".meta-srctype");
  if (srcType) srcType.addEventListener("change", () => updateHighlight(h.id, item => { item.sourceType = srcType.value; }));

  // Quote type chips (direct / paraphrase)
  card.querySelectorAll(".qt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      updateHighlight(h.id, item => { item.quoteType = chip.getAttribute("data-qt"); });
      card.querySelectorAll(".qt-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
    });
  });

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
    else if (h.type === "page") text = `[Seite] ${ref}`;
    else if (h.type === "pagenote") text = `Seiten-Notiz: ${h.note || ""}\n${ref}`;
    else text = `„${h.text}"\n\n${ref}`;
    if (h.note && h.type !== "pagenote") text += `\nNotiz: ${h.note}`;
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
      const kindMap = { image: "Bild", file: "Datei", page: "Seite", pagenote: "Seiten-Notiz" };
      const kind = kindMap[h.type] || "Zitat";
      md += `### ${kind} ${i + 1}: ${h.title || "Unbenannte Seite"}\n\n`;
      if (h.type === "image") md += `![Bildquelle](${h.imageUrl})\n\n`;
      else if (h.type === "file") md += `* **Datei:** ${h.fileName} (${formatBytes(h.fileSize)})\n`;
      else if (h.type === "page") md += `* **Ganze Seite als Quelle gemerkt**\n`;
      else if (h.type === "pagenote") md += `> 📝 ${h.note || ""}\n\n`;
      else md += `> ${h.text}\n\n`;
      const ref = NinaCite.formatReference(h, citationStyle, includeDate);
      if (ref) md += `* **Quelle (${NinaCite.STYLES[citationStyle]}):** ${ref}\n`;
    }
    if ((h.tags || []).length) md += `* **Tags:** ${h.tags.map(t => "#" + t).join(", ")}\n`;
    if (h.note && h.type !== "pagenote") md += `* **Notiz:** ${h.note}\n`;
    md += `\n---\n\n`;
  });

  downloadFile(md, `NINA_${name.replace(/\s+/g, "_")}.md`, "text/markdown");
  showToast("Markdown exportiert!");
}

function copyBibliography() {
  const refs = projectEntries()
    .filter(h => h.type !== "idea" && h.type !== "pagenote")
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
    } else if (h.type === "page") {
      out += `${i + 1}. [Seite] ${h.title || h.url}\n`;
    } else if (h.type === "pagenote") {
      out += `■ 📝 (${getWebsiteName(h.url)}) ${h.note || ""}\n`;
    } else {
      out += `${i + 1}. „${h.text}"\n`;
      const inText = NinaCite.formatInText(h, citationStyle);
      if (inText) out += `   Beleg: ${inText}\n`;
    }
    if (h.note && h.type !== "pagenote") out += `   → ${h.note}\n`;
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

function showUndoToast(message, onUndo) {
  const existing = document.querySelector(".toast-msg");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = "toast-msg with-action";
  const span = document.createElement("span");
  span.textContent = message;
  const btn = document.createElement("button");
  btn.className = "toast-undo";
  btn.textContent = "Rückgängig";
  let done = false;
  btn.addEventListener("click", () => {
    if (done) return;
    done = true;
    onUndo();
    toast.remove();
  });
  toast.appendChild(span);
  toast.appendChild(btn);
  document.body.appendChild(toast);
  toast.offsetHeight;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 5000);
}

/* ===== Statistics dashboard ===== */
function showStats() {
  closePopovers();
  const entries = projectEntries();
  statsTitle.textContent = `Statistik – ${projectName()}`;

  if (entries.length === 0) {
    statsBody.innerHTML = `<p class="stats-empty">Noch keine Einträge in diesem Projekt.</p>`;
    statsModal.style.display = "flex";
    return;
  }

  const count = (fn) => entries.filter(fn).length;
  const isQuote = (h) => !h.type;
  const totals = [
    { label: "Gesamt", value: entries.length },
    { label: "Zitate", value: count(isQuote) },
    { label: "Bilder", value: count(h => h.type === "image") },
    { label: "Dateien", value: count(h => h.type === "file") },
    { label: "Seiten", value: count(h => h.type === "page") },
    { label: "Notizen", value: count(h => h.type === "idea") }
  ].filter(t => t.value > 0 || t.label === "Gesamt");

  // Categories
  const catLabels = { "": "Ohne", definition: "Definition", pro: "Pro", contra: "Contra", important: "Wichtig" };
  const catCounts = {};
  entries.forEach(h => { const c = h.category || ""; catCounts[c] = (catCounts[c] || 0) + 1; });

  // Top domains (sources only)
  const domainCounts = {};
  entries.filter(h => h.url && !h.url.startsWith("Lokal:")).forEach(h => {
    const d = getWebsiteName(h.url);
    domainCounts[d] = (domainCounts[d] || 0) + 1;
  });
  const topDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Citation completeness + last edited
  const sources = entries.filter(h => isQuote(h) || h.type === "image" || h.type === "page");
  const withAuthor = sources.filter(h => h.author && h.author.trim()).length;
  const lastTs = Math.max(...entries.map(h => h.timestamp || 0));

  const numberCards = totals.map(t =>
    `<div class="stat-num"><div class="stat-num-value">${t.value}</div><div class="stat-num-label">${t.label}</div></div>`
  ).join("");

  const catRows = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="stat-row"><span>${catLabels[k] || k}</span><strong>${v}</strong></div>`)
    .join("");

  const domainRows = topDomains.length
    ? topDomains.map(([d, v]) => `<div class="stat-row"><span>${escapeHtml(d)}</span><strong>${v}</strong></div>`).join("")
    : `<div class="stat-row stats-muted"><span>Keine Web-Quellen</span></div>`;

  statsBody.innerHTML = `
    <div class="stat-nums">${numberCards}</div>
    <div class="stat-section">
      <h3>Kategorien</h3>
      ${catRows}
    </div>
    <div class="stat-section">
      <h3>Top-Quellen</h3>
      ${domainRows}
    </div>
    <div class="stat-section">
      <h3>Übersicht</h3>
      <div class="stat-row"><span>Quellen mit Autor</span><strong>${withAuthor} / ${sources.length}</strong></div>
      <div class="stat-row"><span>Zuletzt bearbeitet</span><strong>${lastTs ? formatDate(lastTs) : "—"}</strong></div>
    </div>`;

  statsModal.style.display = "flex";
}

/* ===== Keyboard shortcuts ===== */
function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
}
function anyModalOpen() {
  return [projectModal, statsModal, shortcutsModal].some(m => m.style.display === "flex");
}
function closeModals() {
  projectModal.style.display = "none";
  statsModal.style.display = "none";
  shortcutsModal.style.display = "none";
  closePopovers();
}
function toggleShortcuts(show) {
  shortcutsModal.style.display = show ? "flex" : "none";
}
function focusSearch() { searchInput.focus(); searchInput.select(); }
function cycleSort() {
  const order = ["newest", "oldest", "manual"];
  const next = order[(order.indexOf(sortMode) + 1) % order.length];
  sortSelect.value = next;
  sortMode = next;
  chrome.storage.local.get({ settings: {} }, (r) => {
    chrome.storage.local.set({ settings: { ...r.settings, sortMode: next } }, () => render());
  });
  showToast("Sortierung: " + ({ newest: "Neueste zuerst", oldest: "Älteste zuerst", manual: "Eigene Reihenfolge" }[next]));
}

function handleShortcut(e) {
  if (e.key === "Escape") {
    const popoverOpen = !projectMenu.hasAttribute("hidden") || !moreMenu.hasAttribute("hidden");
    if (anyModalOpen() || popoverOpen) { closeModals(); return; }
    if (document.activeElement === searchInput || searchQuery) {
      searchInput.value = ""; searchQuery = ""; searchInput.blur(); currentPage = 1; render();
    }
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); focusSearch(); return; }
  if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "/") { e.preventDefault(); focusSearch(); return; }
  if (e.key === "?") { e.preventDefault(); toggleShortcuts(shortcutsModal.style.display !== "flex"); return; }

  switch (e.key.toLowerCase()) {
    case "n": e.preventDefault(); addNoteCard(); break;
    case "g":
      e.preventDefault();
      globalSearchToggle.checked = !globalSearchToggle.checked;
      globalSearch = globalSearchToggle.checked;
      currentPage = 1; render();
      break;
    case "e": e.preventDefault(); exportMarkdown(); break;
    case "b": e.preventDefault(); copyBibliography(); break;
    case "s": e.preventDefault(); showStats(); break;
    case "o": e.preventDefault(); cycleSort(); break;
    case "p": e.preventDefault(); togglePopover(projectMenu); break;
  }
}

document.addEventListener("DOMContentLoaded", init);
