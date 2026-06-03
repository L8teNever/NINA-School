// NINA School - Full Page Script (Complete Management)

let highlights = [];
let projects = [];
let activeProjectId = "proj_standard";
let sortDescending = true;
let searchQuery = "";
let isInternalUpdate = false;
let currentPage = 1;
const itemsPerPage = 10;

const projectSelect = document.getElementById("project-select-full");
const addProjectBtn = document.getElementById("add-project-btn-full");
const deleteProjectBtn = document.getElementById("delete-project-btn-full");
const highlightsContainer = document.getElementById("highlights-container");
const emptyState = document.getElementById("empty-full");
const searchInput = document.getElementById("search-full");
const sortBtn = document.getElementById("sort-btn-full");
const exportBtn = document.getElementById("export-markdown-btn");
const copyBibBtn = document.getElementById("copy-bib-btn");
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
    settings: { sortDescending: true }
  }, (result) => {
    let migrated = false;

    let loadedProjects = result.projects || [];
    if (loadedProjects.length === 0) {
      loadedProjects = [{ id: "proj_standard", name: "Standard-Projekt" }];
      migrated = true;
    }
    projects = loadedProjects;

    let activeId = result.activeProjectId;
    if (!activeId) {
      activeId = "proj_standard";
      migrated = true;
    }
    activeProjectId = activeId;

    let loadedHighlights = result.highlights || [];
    loadedHighlights.forEach(h => {
      if (!h.projectId) {
        h.projectId = "proj_standard";
        migrated = true;
      }
    });
    highlights = loadedHighlights;

    if (result.settings && result.settings.sortDescending !== undefined) {
      sortDescending = result.settings.sortDescending;
    }

    if (migrated) {
      chrome.storage.local.set({ projects, activeProjectId, highlights });
    }

    renderProjectsDropdown();
    render();

    // Event listeners
    projectSelect.addEventListener("change", handleProjectChange);
    addProjectBtn.addEventListener("click", showProjectModal);
    deleteProjectBtn.addEventListener("click", deleteActiveProject);
    modalCancel.addEventListener("click", hideProjectModal);
    modalSave.addEventListener("click", saveNewProject);
    searchInput.addEventListener("input", handleSearch);
    sortBtn.addEventListener("click", toggleSort);
    exportBtn.addEventListener("click", exportMarkdown);
    copyBibBtn.addEventListener("click", copyBibliography);
    prevPageBtn.addEventListener("click", () => goToPreviousPage());
    nextPageBtn.addEventListener("click", () => goToNextPage());

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.highlights && !isInternalUpdate) highlights = changes.highlights.newValue || [];
        if (changes.projects) projects = changes.projects.newValue || [];
        if (changes.activeProjectId) activeProjectId = changes.activeProjectId.newValue || "proj_standard";

        renderProjectsDropdown();
        render();
      }
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

  if (activeProjectId === "proj_standard") {
    deleteProjectBtn.style.opacity = "0.3";
    deleteProjectBtn.style.pointerEvents = "none";
  } else {
    deleteProjectBtn.style.opacity = "1";
    deleteProjectBtn.style.pointerEvents = "auto";
  }
}

function handleProjectChange(e) {
  activeProjectId = e.target.value;
  chrome.storage.local.set({ activeProjectId }, () => {
    render();
  });
}

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
  if (!name) {
    showToast("Bitte gib einen Projektnamen ein!");
    return;
  }

  const id = "proj_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  projects.push({ id, name });
  activeProjectId = id;

  chrome.storage.local.set({ projects, activeProjectId }, () => {
    renderProjectsDropdown();
    hideProjectModal();
    render();
    showToast(`Projekt "${name}" erstellt!`);
  });
}

function deleteActiveProject() {
  if (activeProjectId === "proj_standard") return;

  const projectToDelete = projects.find(p => p.id === activeProjectId);
  if (!projectToDelete) return;

  const confirmDelete = confirm(`Möchtest du das Projekt "${projectToDelete.name}" und alle Zitate wirklich löschen?`);
  if (!confirmDelete) return;

  highlights = highlights.filter(h => h.projectId !== activeProjectId);
  projects = projects.filter(p => p.id !== activeProjectId);
  activeProjectId = "proj_standard";

  chrome.storage.local.set({ projects, activeProjectId, highlights }, () => {
    renderProjectsDropdown();
    render();
    showToast("Projekt gelöscht");
  });
}

function handleSearch(e) {
  searchQuery = e.target.value.toLowerCase().trim();
  currentPage = 1;
  render();
}

function goToPreviousPage() {
  if (currentPage > 1) {
    currentPage--;
    render();
    highlightsContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

function goToNextPage() {
  const totalPages = Math.ceil(
    highlights.filter(h => h.projectId === activeProjectId).length / itemsPerPage
  );
  if (currentPage < totalPages) {
    currentPage++;
    render();
    highlightsContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

function toggleSort() {
  sortDescending = !sortDescending;
  const settings = { sortDescending };
  chrome.storage.local.set({ settings }, () => {
    render();
  });
}

function render() {
  let filtered = highlights.filter(h => {
    if (h.projectId !== activeProjectId) return false;

    const textMatch = h.text && h.text.toLowerCase().includes(searchQuery);
    const noteMatch = h.note && h.note.toLowerCase().includes(searchQuery);
    const titleMatch = h.title && h.title.toLowerCase().includes(searchQuery);
    const fileMatch = h.fileName && h.fileName.toLowerCase().includes(searchQuery);
    return textMatch || noteMatch || titleMatch || fileMatch;
  });

  filtered.sort((a, b) => {
    return sortDescending ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
  });

  if (filtered.length === 0) {
    highlightsContainer.style.display = "none";
    pagination.style.display = "none";
    emptyState.style.display = "flex";
    return;
  }

  highlightsContainer.style.display = "flex";
  emptyState.style.display = "none";

  // Calculate pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pageItems = filtered.slice(startIndex, endIndex);

  // Render pagination
  pagination.style.display = filtered.length > itemsPerPage ? "flex" : "none";
  pageNumber.textContent = `Seite ${currentPage}`;
  pageStats.textContent = `${startIndex + 1}–${Math.min(endIndex, filtered.length)} von ${filtered.length}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages;

  highlightsContainer.innerHTML = "";

  pageItems.forEach(h => {
    const card = document.createElement("div");
    card.className = "highlight-card-full";
    card.setAttribute("data-id", h.id);

    let cardContent = "";
    if (h.type === "image") {
      cardContent = `
        <div class="card-image-container">
          <img src="${escapeHtml(h.imageUrl)}" class="card-image-preview" alt="Bildquelle">
        </div>
      `;
    } else if (h.type === "file") {
      cardContent = `
        <div class="card-file-container">
          <div class="file-icon">
            <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          </div>
          <div class="file-details">
            <div class="file-name" title="${escapeHtml(h.fileName)}">${escapeHtml(h.fileName)}</div>
            <div class="file-size">${formatBytes(h.fileSize)}</div>
          </div>
        </div>
      `;
    } else {
      cardContent = `<div class="card-text">„${escapeHtml(h.text)}"</div>`;
    }

    const isLocalFile = h.url && h.url.startsWith("Lokal:");

    card.innerHTML = `
      <div class="card-header">
        <div class="card-source">
          <div class="card-domain">${escapeHtml(getWebsiteName(h.url))}</div>
          <div class="card-source-title">${escapeHtml(h.title || "Unbenannte Seite")}</div>
        </div>
        <div class="card-date">${formatDate(h.timestamp)}</div>
      </div>

      ${cardContent}

      <textarea class="card-note" data-id="${h.id}" placeholder="Notiz hinzufügen...">${escapeHtml(h.note || "")}</textarea>

      <div class="card-actions">
        ${isLocalFile ? '' : `
          <a href="${escapeHtml(h.url)}" target="_blank" class="card-action-btn">
            <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
            Öffnen
          </a>
        `}
        <button class="card-action-btn copy" data-id="${h.id}">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          Kopieren
        </button>
        <button class="card-action-btn delete" data-id="${h.id}">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Löschen
        </button>
      </div>
    `;

    const noteTextarea = card.querySelector(".card-note");
    const copyBtn = card.querySelector(".copy");
    const deleteBtn = card.querySelector(".delete");

    noteTextarea.addEventListener("input", (e) => {
      const id = e.target.getAttribute("data-id");
      const idx = highlights.findIndex(x => x.id === id);
      if (idx !== -1) {
        highlights[idx].note = e.target.value;
        saveHighlights();
      }
    });

    copyBtn.addEventListener("click", () => {
      let text = "";
      if (h.type === "image") {
        text = `[Bildquelle] — Quelle: ${h.title}\nLink: ${h.url}\nBild-URL: ${h.imageUrl}${h.note ? `\nNotiz: ${h.note}` : ""}`;
      } else if (h.type === "file") {
        text = `[Lokale Datei] — Name: ${h.fileName} (${formatBytes(h.fileSize)})${h.note ? `\nNotiz: ${h.note}` : ""}`;
      } else {
        text = `„${h.text}"\n\nQuelle: ${h.title}\nLink: ${h.url}\nDatum: ${formatDate(h.timestamp)}${h.note ? `\nNotiz: ${h.note}` : ""}`;
      }
      navigator.clipboard.writeText(text).then(() => showToast("Kopiert!"));
    });

    deleteBtn.addEventListener("click", () => {
      highlights = highlights.filter(x => x.id !== h.id);
      saveHighlights();
      render();
      showToast("Zitat gelöscht");
    });

    highlightsContainer.appendChild(card);
  });
}

function getWebsiteName(urlString) {
  if (urlString && urlString.startsWith("Lokal:")) {
    return "Lokale Datei";
  }
  try {
    const url = new URL(urlString);
    let host = url.hostname.replace("www.", "");
    let parts = host.split('.');

    if (parts.length > 1) {
      if (['de', 'en', 'support', 'm'].includes(parts[0])) {
        return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      }
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    }
    return host;
  } catch (e) {
    return "Webseite";
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function saveHighlights() {
  isInternalUpdate = true;
  chrome.storage.local.set({ highlights }, () => {
    setTimeout(() => {
      isInternalUpdate = false;
    }, 150);
  });
}

function exportMarkdown() {
  const projectHighlights = highlights.filter(h => h.projectId === activeProjectId);

  if (projectHighlights.length === 0) {
    showToast("Keine Einträge zum Exportieren");
    return;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectName = activeProject ? activeProject.name : "Quellensammlung";

  let mdContent = `# NINA School - Literatursammlung: ${projectName}\n`;
  mdContent += `Generiert am: ${new Date().toLocaleDateString("de-DE")} - Anzahl Einträge: ${projectHighlights.length}\n\n---\n\n`;

  const sorted = [...projectHighlights].sort((a, b) => b.timestamp - a.timestamp);

  sorted.forEach((h, index) => {
    mdContent += `### ${h.type === "image" ? "Bild" : h.type === "file" ? "Datei" : "Zitat"} ${index + 1}: ${h.title || "Unbenannte Seite"}\n\n`;
    if (h.type === "image") {
      mdContent += `![Bildquelle](${h.imageUrl})\n\n`;
    } else if (h.type === "file") {
      mdContent += `* **Datei:** ${h.fileName} (${formatBytes(h.fileSize)})\n`;
    } else {
      mdContent += `> „${h.text}"\n\n`;
    }
    mdContent += `* **Quelle:** [${h.title || "Link"}](${h.url})\n`;
    mdContent += `* **Datum:** ${formatDate(h.timestamp)}\n`;
    if (h.note) {
      mdContent += `* **Notiz:** ${h.note}\n`;
    }
    mdContent += `\n---\n\n`;
  });

  const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NINA_School_${projectName.replace(/\s+/g, "_")}_Zitate.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Markdown-Datei exportiert!");
}

function copyBibliography() {
  const projectHighlights = highlights.filter(h => h.projectId === activeProjectId);

  if (projectHighlights.length === 0) {
    showToast("Keine Einträge zum Kopieren");
    return;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const projectName = activeProject ? activeProject.name : "Quellensammlung";

  const sorted = [...projectHighlights].sort((a, b) => {
    const nameA = getWebsiteName(a.url).toLowerCase();
    const nameB = getWebsiteName(b.url).toLowerCase();
    return nameA.localeCompare(nameB);
  });

  let bibText = `NINA School - Quellensammlung: ${projectName}\n\n`;
  sorted.forEach(h => {
    if (h.type === "image") {
      bibText += `- [Bild] aus: ${h.title} (${h.url}) — Gesichert am: ${formatDate(h.timestamp)}\n`;
    } else if (h.type === "file") {
      bibText += `- [Datei] ${h.fileName} (${formatBytes(h.fileSize)}) — Gesichert am: ${formatDate(h.timestamp)}\n`;
    } else {
      bibText += `- „${h.text}" — aus: ${h.title} (${h.url}) — Gesichert am: ${formatDate(h.timestamp)}\n`;
    }
    if (h.note) {
      bibText += `  Notiz: ${h.note}\n`;
    }
    bibText += `\n`;
  });

  navigator.clipboard.writeText(bibText).then(() => {
    showToast(`Quellen für "${projectName}" kopiert!`);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener("DOMContentLoaded", init);
