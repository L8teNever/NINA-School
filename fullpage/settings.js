// NINA School - Settings Script

const darkModeToggle = document.getElementById("dark-mode");
const floatingBtnToggle = document.getElementById("floating-btn");
const autoSaveToggle = document.getElementById("auto-save");
const exportFormatSelect = document.getElementById("export-format");
const includeDateToggle = document.getElementById("include-date");
const deleteAllBtn = document.getElementById("delete-all");
const exportDataBtn = document.getElementById("export-data");
const importDataBtn = document.getElementById("import-data");
const importFile = document.getElementById("import-file");

function loadSettings() {
  chrome.storage.local.get({
    settings: {
      darkMode: true,
      floatingButton: true,
      autoSave: false,
      exportFormat: "markdown",
      includeDate: true
    }
  }, (result) => {
    const settings = result.settings;

    darkModeToggle.checked = settings.darkMode;
    floatingBtnToggle.checked = settings.floatingButton;
    autoSaveToggle.checked = settings.autoSave;
    exportFormatSelect.value = settings.exportFormat;
    includeDateToggle.checked = settings.includeDate;
  });
}

function saveSettings() {
  const settings = {
    darkMode: darkModeToggle.checked,
    floatingButton: floatingBtnToggle.checked,
    autoSave: autoSaveToggle.checked,
    exportFormat: exportFormatSelect.value,
    includeDate: includeDateToggle.checked
  };

  chrome.storage.local.set({ settings }, () => {
    showToast("Einstellungen gespeichert");
  });
}

darkModeToggle.addEventListener("change", saveSettings);
floatingBtnToggle.addEventListener("change", saveSettings);
autoSaveToggle.addEventListener("change", saveSettings);
exportFormatSelect.addEventListener("change", saveSettings);
includeDateToggle.addEventListener("change", saveSettings);

deleteAllBtn.addEventListener("click", () => {
  const confirm = window.confirm(
    "Möchtest du wirklich alle Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden!"
  );

  if (confirm) {
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

importDataBtn.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      const confirm = window.confirm(
        "Möchtest du diese Daten wirklich importieren? Bestehende Daten werden überschrieben."
      );

      if (confirm) {
        chrome.storage.local.set(data, () => {
          showToast("✓ Daten importiert");
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        });
      }
    } catch (error) {
      showToast("✗ Fehler beim Importieren der Datei");
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
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: #262626;
    color: #4dd9d9;
    border: 1px solid #4dd9d9;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    z-index: 10000;
    opacity: 0;
    transition: all 0.25s;
    pointer-events: none;
  `;

  document.body.appendChild(toast);
  toast.offsetHeight;
  toast.style.opacity = "1";
  toast.style.transform = "translateX(-50%) translateY(0)";

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(-50%) translateY(20px)";
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

document.addEventListener("DOMContentLoaded", loadSettings);
