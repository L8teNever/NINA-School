// NINA School - Sidebar Script

let highlights = [];
let projects = [];
let activeProjectId = "proj_standard";
let currentView = "sources";
let selectedSourceUrl = "";

const sourcesView = document.getElementById("sources-view");
const detailsView = document.getElementById("details-view");
const sourcesFeed = document.getElementById("sources-feed");
const detailsFeed = document.getElementById("details-feed");
const projectSelect = document.getElementById("project-select");
const newProjectBtn = document.getElementById("new-project-btn");
const openFullpageBtn = document.getElementById("open-fullpage-btn");
const openSettingsBtn = document.getElementById("open-settings-btn");
const backBtn = document.getElementById("back-btn");
const emptyState = document.getElementById("empty-state");
const detailsDomain = document.getElementById("details-domain");
const detailsTitle = document.getElementById("details-title");

// Modal
const projectModal = document.getElementById("project-modal");
const projectNameInput = document.getElementById("project-name-input");
const modalCancel = document.getElementById("modal-cancel");
const modalSave = document.getElementById("modal-save");

function init() {
  chrome.storage.local.get({
    highlights: [],
    projects: [],
    activeProjectId: ""
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

    if (migrated) {
      chrome.storage.local.set({ projects, activeProjectId, highlights });
    }

    renderProjectSelect();
    render();

    openFullpageBtn.addEventListener("click", openFullPage);
    openSettingsBtn.addEventListener("click", openSettings);
    backBtn.addEventListener("click", goBackToSources);
    projectSelect.addEventListener("change", handleProjectChange);
    newProjectBtn.addEventListener("click", showProjectModal);
    modalCancel.addEventListener("click", hideProjectModal);
    modalSave.addEventListener("click", saveNewProject);
    projectNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveNewProject();
      if (e.key === "Escape") hideProjectModal();
    });

    const uploadFileBtn = document.getElementById("upload-file-btn");
    const sidebarFileInput = document.getElementById("sidebar-file-input");
    uploadFileBtn.addEventListener("click", () => sidebarFileInput.click());
    sidebarFileInput.addEventListener("change", handleFileUpload);

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.highlights) highlights = changes.highlights.newValue || [];
        if (changes.projects) projects = changes.projects.newValue || [];
        if (changes.activeProjectId) activeProjectId = changes.activeProjectId.newValue || "proj_standard";

        renderProjectSelect();
        render();
      }
    });
  });
}

function renderProjectSelect() {
  projectSelect.innerHTML = "";
  projects.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    option.selected = p.id === activeProjectId;
    projectSelect.appendChild(option);
  });
}

function handleProjectChange(e) {
  activeProjectId = e.target.value;
  currentView = "sources";
  selectedSourceUrl = "";
  chrome.storage.local.set({ activeProjectId }, () => render());
}

function openFullPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL("fullpage/fullpage.html") });
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL("fullpage/settings.html") });
}

/* ===== New Project Modal ===== */
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
    showToast("Bitte Projektnamen eingeben");
    projectNameInput.focus();
    return;
  }
  const id = "proj_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  projects.push({ id, name });
  activeProjectId = id;
  currentView = "sources";
  selectedSourceUrl = "";

  chrome.storage.local.set({ projects, activeProjectId }, () => {
    renderProjectSelect();
    hideProjectModal();
    render();
    showToast(`Projekt „${name}" erstellt`);
  });
}

function goBackToSources() {
  currentView = "sources";
  selectedSourceUrl = "";
  render();
}

function getGroupedSources(filteredHighlights) {
  const groups = {};
  filteredHighlights.forEach(h => {
    const url = h.url;
    if (!groups[url]) {
      groups[url] = {
        url,
        title: h.title || "Unbenannte Seite",
        domain: getWebsiteName(url),
        count: 0,
        highlights: []
      };
    }
    groups[url].count++;
    groups[url].highlights.push(h);
  });

  return Object.values(groups).sort((a, b) => {
    const latestA = Math.max(...a.highlights.map(h => h.timestamp), 0);
    const latestB = Math.max(...b.highlights.map(h => h.timestamp), 0);
    return latestB - latestA;
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

function render() {
  const filtered = highlights.filter(h => h.projectId === activeProjectId);

  if (currentView === "sources") {
    sourcesView.classList.add("active");
    detailsView.classList.remove("active");
    renderSourcesList(getGroupedSources(filtered));
  } else {
    sourcesView.classList.remove("active");
    detailsView.classList.add("active");
    const sourceHighlights = filtered.filter(h => h.url === selectedSourceUrl);

    if (sourceHighlights.length === 0) {
      goBackToSources();
      return;
    }

    const sample = sourceHighlights[0];
    detailsDomain.textContent = getWebsiteName(selectedSourceUrl);
    detailsTitle.textContent = sample.title || "Unbenannte Seite";

    renderQuotesList(sourceHighlights);
  }
}

function renderSourcesList(groupedSources) {
  sourcesFeed.innerHTML = "";

  if (groupedSources.length === 0) {
    emptyState.style.display = "flex";
    return;
  }
  emptyState.style.display = "none";

  groupedSources.forEach(src => {
    const card = document.createElement("div");
    card.className = "source-card";
    card.innerHTML = `
      <div class="source-card-content">
        <div class="source-card-icon">
          <svg viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
        </div>
        <div class="source-card-info">
          <div class="source-card-domain">${escapeHtml(src.domain)}</div>
          <div class="source-card-title">${escapeHtml(src.title)}</div>
          <div class="source-card-count">${src.count} Eintrag${src.count > 1 ? "e" : ""}</div>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      currentView = "details";
      selectedSourceUrl = src.url;
      render();
    });
    sourcesFeed.appendChild(card);
  });
}

function renderQuotesList(sourceHighlights) {
  detailsFeed.innerHTML = "";

  sourceHighlights.forEach(h => {
    const card = document.createElement("div");
    card.className = "quote-card";

    let cardContent = "";
    if (h.type === "image") {
      cardContent = `
        <div class="quote-image-container">
          <img src="${escapeHtml(h.imageUrl)}" class="quote-image-preview" alt="Bildquelle">
        </div>`;
    } else if (h.type === "file") {
      cardContent = `
        <div class="quote-file-container">
          <div class="file-icon">
            <svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
          </div>
          <div class="file-details">
            <div class="file-name" title="${escapeHtml(h.fileName)}">${escapeHtml(h.fileName)}</div>
            <div class="file-size">${formatBytes(h.fileSize)}</div>
          </div>
        </div>`;
    } else {
      cardContent = `<div class="quote-text">${escapeHtml(h.text)}</div>`;
    }

    card.innerHTML = `
      ${cardContent}
      <div class="quote-actions">
        <button class="quote-btn copy-btn" data-id="${h.id}">
          <svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          Kopieren
        </button>
        <button class="quote-btn delete" data-id="${h.id}">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          Löschen
        </button>
      </div>
    `;

    card.querySelector(".copy-btn").addEventListener("click", () => {
      let copyText = "";
      if (h.type === "image") {
        copyText = `[Bildquelle] — Quelle: ${h.title}\nLink: ${h.url}\nBild-URL: ${h.imageUrl}`;
      } else if (h.type === "file") {
        copyText = `[Lokale Datei] — Name: ${h.fileName} (${formatBytes(h.fileSize)})`;
      } else {
        copyText = `„${h.text}"\n\nQuelle: ${h.title}\nLink: ${h.url}`;
      }
      navigator.clipboard.writeText(copyText).then(() => showToast("Kopiert!"));
    });

    card.querySelector(".delete").addEventListener("click", () => {
      highlights = highlights.filter(x => x.id !== h.id);
      saveHighlights();
      render();
      showToast("Gelöscht");
    });

    detailsFeed.appendChild(card);
  });
}

function saveHighlights() {
  chrome.storage.local.set({ highlights });
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

/* ===== Local File Upload ===== */
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  if (file.type.startsWith("image/")) {
    reader.onload = function(evt) {
      saveUploadedFile({
        type: "image",
        imageUrl: evt.target.result,
        title: file.name,
        url: "Lokal: " + file.name
      });
    };
    reader.readAsDataURL(file);
  } else {
    saveUploadedFile({
      type: "file",
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      title: file.name,
      url: "Lokal: " + file.name
    });
  }
}

function saveUploadedFile(fileData) {
  const id = "nina_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const newHighlight = {
    id,
    timestamp: Date.now(),
    projectId: activeProjectId,
    note: "",
    ...fileData
  };
  highlights.push(newHighlight);
  saveHighlights();
  render();
  document.getElementById("sidebar-file-input").value = "";
  showToast("Hinzugefügt!");
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

document.addEventListener("DOMContentLoaded", init);
