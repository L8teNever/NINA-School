// NINA School - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Right-click context menu for text selection
  chrome.contextMenus.create({
    id: "add-to-nina-school",
    title: "Text zu NINA School hinzufügen",
    contexts: ["selection"]
  });

  // Right-click context menu for images
  chrome.contextMenus.create({
    id: "add-image-to-nina-school",
    title: "Bild zu NINA School hinzufügen",
    contexts: ["image"]
  });

  // Open the side panel when the toolbar icon is clicked
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
  }
});

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

// Persist a highlight under the active project, then notify the tab.
function persistHighlight(tabId, build, notify) {
  chrome.storage.local.get({ activeProjectId: "proj_standard", highlights: [] }, (result) => {
    const activeId = result.activeProjectId || "proj_standard";
    const highlights = result.highlights;
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

  if (info.menuItemId === "add-to-nina-school" && info.selectionText) {
    const text = info.selectionText;
    getMeta(tab.id, (meta) => {
      persistHighlight(
        tab.id,
        () => ({
          id, text, url, title, timestamp,
          note: "", category: "", tags: [], order: timestamp,
          author: meta.author, publishedDate: meta.publishedDate, siteName: meta.siteName
        }),
        (h) => ({ action: "visualizeLastSelection", highlight: h })
      );
    });
  } else if (info.menuItemId === "add-image-to-nina-school" && info.srcUrl) {
    const imageUrl = info.srcUrl;
    getMeta(tab.id, (meta) => {
      persistHighlight(
        tab.id,
        () => ({
          id, type: "image", imageUrl, url, title, timestamp,
          note: "", category: "", tags: [], order: timestamp,
          author: meta.author, publishedDate: meta.publishedDate, siteName: meta.siteName
        }),
        () => ({ action: "flashImageSrc", srcUrl: imageUrl })
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
