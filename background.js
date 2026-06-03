// NINA School - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Create right-click context menu item for text selection
  chrome.contextMenus.create({
    id: "add-to-nina-school",
    title: "Text zu NINA School hinzufügen",
    contexts: ["selection"]
  });

  // Create right-click context menu item for images
  chrome.contextMenus.create({
    id: "add-image-to-nina-school",
    title: "Bild zu NINA School hinzufügen",
    contexts: ["image"]
  });

  // Configure extension action (clicking the toolbar icon) to open the side panel
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting panel behavior:", error));
  }
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab) return;

  const timestamp = Date.now();
  const id = "nina_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const url = tab.url || info.pageUrl || "";
  const title = tab.title || "Unbenannte Seite";

  if (info.menuItemId === "add-to-nina-school" && info.selectionText) {
    const text = info.selectionText;

    // Load active project ID and save text highlight
    chrome.storage.local.get({ activeProjectId: "proj_standard", highlights: [] }, (result) => {
      const activeId = result.activeProjectId || "proj_standard";
      const highlights = result.highlights;

      const newHighlight = {
        id,
        text,
        url,
        title,
        timestamp,
        projectId: activeId,
        note: ""
      };

      highlights.push(newHighlight);
      chrome.storage.local.set({ highlights }, () => {
        // Send message to the tab to apply visual highlight style
        chrome.tabs.sendMessage(tab.id, {
          action: "visualizeLastSelection",
          highlight: newHighlight
        }).catch((err) => console.log("Visual highlight skipped:", err));
      });
    });
  } else if (info.menuItemId === "add-image-to-nina-school" && info.srcUrl) {
    const imageUrl = info.srcUrl;

    // Load active project ID and save image highlight
    chrome.storage.local.get({ activeProjectId: "proj_standard", highlights: [] }, (result) => {
      const activeId = result.activeProjectId || "proj_standard";
      const highlights = result.highlights;

      const newHighlight = {
        id,
        type: "image",
        imageUrl,
        url,
        title,
        timestamp,
        projectId: activeId,
        note: ""
      };

      highlights.push(newHighlight);
      chrome.storage.local.set({ highlights }, () => {
        // Send message to the tab to flash the saved image
        chrome.tabs.sendMessage(tab.id, {
          action: "flashImageSrc",
          srcUrl: imageUrl
        }).catch((err) => console.log("Visual flash skipped:", err));
      });
    });
  }
});
