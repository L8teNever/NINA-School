// NINA School - Settings Script

const DEFAULT_SETTINGS = {
  sortDescending: true,
  floatingButton: true,
  imageSave: true,
  includeDate: true
};

let currentSettings = { ...DEFAULT_SETTINGS };

const floatingBtnToggle = document.getElementById("floating-btn");
const imageSaveToggle = document.getElementById("image-save");
const includeDateToggle = document.getElementById("include-date");
const deleteAllBtn = document.getElementById("delete-all");
const exportDataBtn = document.getElementById("export-data");
const importDataBtn = document.getElementById("import-data");
const importFile = document.getElementById("import-file");
const backToApp = document.getElementById("back-to-app");

function loadSettings() {
  chrome.storage.local.get({ settings: {} }, (result) => {
    currentSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };

    floatingBtnToggle.checked = currentSettings.floatingButton;
    imageSaveToggle.checked = currentSettings.imageSave;
    includeDateToggle.checked = currentSettings.includeDate;
  });
}

function saveSettings() {
  // Merge UI values into the existing settings object so we never clobber
  // keys owned by other pages (e.g. sortDescending from the full view).
  currentSettings = {
    ...currentSettings,
    floatingButton: floatingBtnToggle.checked,
    imageSave: imageSaveToggle.checked,
    includeDate: includeDateToggle.checked
  };

  chrome.storage.local.set({ settings: currentSettings }, () => {
    showToast("Gespeichert");
  });
}

floatingBtnToggle.addEventListener("change", saveSettings);
imageSaveToggle.addEventListener("change", saveSettings);
includeDateToggle.addEventListener("change", saveSettings);

backToApp.addEventListener("click", () => {
  window.location.href = "fullpage.html";
});

deleteAllBtn.addEventListener("click", () => {
  const ok = window.confirm(
    "Möchtest du wirklich ALLE Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden!"
  );
  if (ok) {
    chrome.storage.local.set({
      highlights: [],
      projects: [{ id: "proj_standard", name: "Standard-Projekt" }],
      activeProjectId: "proj_standard"
    }, () => {
      showToast("✓ Alle Daten gelöscht");
    });
  }
});

exportDataBtn.addEventListener("click", () => {
  chrome.storage.local.get(null, (result) => {
    const dataStr = JSON.stringify(result, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nina-school-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("✓ Daten exportiert");
  });
});

importDataBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      const ok = window.confirm(
        "Möchtest du diese Daten wirklich importieren? Bestehende Daten werden überschrieben."
      );
      if (ok) {
        chrome.storage.local.set(data, () => {
          showToast("✓ Daten importiert");
          setTimeout(() => window.location.reload(), 1200);
        });
      }
    } catch (error) {
      showToast("✗ Datei konnte nicht gelesen werden");
      console.error(error);
    }
  };
  reader.readAsText(file);
  importFile.value = "";
});

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
  }, 2000);
}

document.addEventListener("DOMContentLoaded", loadSettings);
