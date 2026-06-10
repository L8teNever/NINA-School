// NINA School - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-nina-school",
    title: "Text zu NINA School hinzufügen",
    contexts: ["selection"]
  });
  chrome.contextMenus.create({
    id: "add-image-to-nina-school",
    title: "Bild zu NINA School hinzufügen",
    contexts: ["image"]
  });
  chrome.contextMenus.create({
    id: "add-page-to-nina-school",
    title: "Diese Seite zu NINA School merken",
    contexts: ["page"]
  });

  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
  }

  chrome.action.setBadgeBackgroundColor({ color: "#2ba8a8" });
});

function cleanUrl(u) {
  return (u || "").split("#")[0].replace(/\/$/, "");
}

// Ask the content script for citation metadata; tolerate pages without it.
function getMeta(tabId, cb) {
  const empty = { author: "", publishedDate: "", siteName: "" };
  try {
    chrome.tabs.sendMessage(tabId, { action: "getPageMeta" }, (resp) => {
      if (chrome.runtime.lastError || !resp) cb(empty);
      else cb(resp);
    });
  } catch (e) {
    cb(empty);
  }
}

function toastTab(tabId, message) {
  chrome.tabs.sendMessage(tabId, { action: "ninaToast", message }).catch(() => {});
}

// Persist a highlight under the active project. `isDup` may veto the save.
function persistHighlight(tabId, build, notify, isDup) {
  chrome.storage.local.get({ activeProjectId: "proj_standard", highlights: [] }, (result) => {
    const activeId = result.activeProjectId || "proj_standard";
    const highlights = result.highlights;
    if (isDup && isDup(highlights, activeId)) {
      toastTab(tabId, "Schon in diesem Projekt gespeichert");
      return;
    }
    const newHighlight = { projectId: activeId, ...build() };
    highlights.push(newHighlight);
    chrome.storage.local.set({ highlights }, () => {
      if (notify) chrome.tabs.sendMessage(tabId, notify(newHighlight)).catch(() => {});
    });
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;

  const timestamp = Date.now();
  const id = "nina_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const url = tab.url || info.pageUrl || "";
  const title = tab.title || "Unbenannte Seite";
  const baseFields = {
    note: "", category: "", tags: [], order: timestamp,
    quoteType: "direct", page: "", sourceType: "website"
  };

  if (info.menuItemId === "add-to-nina-school" && info.selectionText) {
    const text = info.selectionText;
    getMeta(tab.id, (meta) => {
      persistHighlight(
        tab.id,
        () => ({ id, text, url, title, timestamp, ...baseFields, author: meta.author, publishedDate: meta.publishedDate, siteName: meta.siteName }),
        (h) => ({ action: "visualizeLastSelection", highlight: h }),
        (highlights, activeId) => highlights.some(h => h.projectId === activeId && h.text === text && h.url === url)
      );
    });
  } else if (info.menuItemId === "add-image-to-nina-school" && info.srcUrl) {
    const imageUrl = info.srcUrl;
    getMeta(tab.id, (meta) => {
      persistHighlight(
        tab.id,
        () => ({ id, type: "image", imageUrl, url, title, timestamp, ...baseFields, author: meta.author, publishedDate: meta.publishedDate, siteName: meta.siteName }),
        () => ({ action: "flashImageSrc", srcUrl: imageUrl }),
        (highlights, activeId) => highlights.some(h => h.type === "image" && h.imageUrl === imageUrl && h.projectId === activeId)
      );
    });
  } else if (info.menuItemId === "add-page-to-nina-school") {
    getMeta(tab.id, (meta) => {
      persistHighlight(
        tab.id,
        () => ({ id, type: "page", text: "", url, title, timestamp, ...baseFields, author: meta.author, publishedDate: meta.publishedDate, siteName: meta.siteName }),
        () => ({ action: "ninaToast", message: "Seite gemerkt ✓" }),
        (highlights, activeId) => highlights.some(h => h.type === "page" && cleanUrl(h.url) === cleanUrl(url) && h.projectId === activeId)
      );
    });
  }
});

// Keyboard shortcut → tell the active tab to save the current selection.
chrome.commands.onCommand.addListener((command) => {
  if (command !== "save-selection") return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.id != null) {
      chrome.tabs.sendMessage(tab.id, { action: "saveSelectionCommand" }).catch(() => {});
    }
  });
});

/* ===== Toolbar badge: number of highlights on the current page ===== */
function updateBadge(tab) {
  if (!tab || tab.id == null || !tab.url) return;
  chrome.storage.local.get({ highlights: [], activeProjectId: "proj_standard" }, (result) => {
    const activeId = result.activeProjectId || "proj_standard";
    const count = (result.highlights || []).filter(h =>
      h.projectId === activeId && h.url && cleanUrl(h.url) === cleanUrl(tab.url)
    ).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "", tabId: tab.id });
  });
}

function refreshActiveBadges() {
  chrome.tabs.query({ active: true }, (tabs) => tabs.forEach(updateBadge));
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, (tab) => { if (!chrome.runtime.lastError) updateBadge(tab); });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" || changeInfo.url) updateBadge(tab);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.highlights || changes.activeProjectId)) {
    refreshActiveBadges();
  }
});
