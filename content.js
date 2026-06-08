// NINA School - Content Script (Projects Integration)

let floatingButton = null;

// User preferences (toggled from the settings page). Defaults = everything on.
let ninaSettings = { floatingButton: true, imageSave: true };
chrome.storage.local.get({ settings: {} }, (r) => {
  ninaSettings = { floatingButton: true, imageSave: true, ...(r.settings || {}) };
});

// Read citation metadata (author / publish date / site name) from the page's meta tags.
function getPageMeta() {
  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const val = el.getAttribute("content") || el.getAttribute("datetime") || el.textContent;
        if (val && val.trim()) return val.trim();
      }
    }
    return "";
  };

  const author = pick([
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="citation_author"]',
    'meta[name="dc.creator"]',
    'meta[property="book:author"]'
  ]);

  const publishedDate = pick([
    'meta[property="article:published_time"]',
    'meta[name="citation_publication_date"]',
    'meta[name="date"]',
    'meta[name="dc.date"]',
    'meta[itemprop="datePublished"]',
    'time[datetime]'
  ]);

  const siteName = pick([
    'meta[property="og:site_name"]',
    'meta[name="application-name"]'
  ]);

  return { author, publishedDate, siteName };
}

// Initialize floating highlighter button
function initFloatingButton() {
  if (!document.body) {
    document.addEventListener("DOMContentLoaded", initFloatingButton);
    return;
  }
  if (document.getElementById("nina-floating-highlighter")) return;

  floatingButton = document.createElement("button");
  floatingButton.id = "nina-floating-highlighter";
  floatingButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z"/>
      <path d="M22 13.47l-10 5.46-10-5.46V18l10 5.5 10-5.5v-4.53z"/>
    </svg>
    <span>Zu NINA</span>
  `;
  document.body.appendChild(floatingButton);

  floatingButton.addEventListener("mousedown", (e) => {
    // Prevent selection from clearing before click registers
    e.preventDefault();
    e.stopPropagation();
  });

  floatingButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveCurrentSelection();
  });
}

// Get the text context (prefix & suffix) for robust search and restoration later
function getSelectionData() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const text = selection.toString();
  if (text.trim() === "") return null;

  const body = document.body;
  const textNodes = [];
  let aggregatedText = "";

  const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      // Skip scripts, styles, textareas and our own extension UI elements
      if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'noscript') {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.classList.contains('nina-highlight-span') || parent.id === 'nina-floating-highlighter') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);

  let node;
  while (node = walk.nextNode()) {
    textNodes.push({
      node: node,
      start: aggregatedText.length,
      end: aggregatedText.length + node.nodeValue.length
    });
    aggregatedText += node.nodeValue;
  }

  const startNode = range.startContainer;
  const startOffset = range.startOffset;
  const endNode = range.endContainer;
  const endOffset = range.endOffset;

  let selectionStartIdx = -1;
  let selectionEndIdx = -1;

  for (const item of textNodes) {
    if (item.node === startNode) {
      selectionStartIdx = item.start + startOffset;
    }
    if (item.node === endNode) {
      selectionEndIdx = item.start + endOffset;
    }
  }

  // Fallback if container nodes aren't found directly
  if (selectionStartIdx === -1 || selectionEndIdx === -1) {
    const idx = aggregatedText.indexOf(text);
    if (idx !== -1) {
      selectionStartIdx = idx;
      selectionEndIdx = idx + text.length;
    } else {
      return { text, prefix: "", suffix: "" };
    }
  }

  const prefix = aggregatedText.substring(Math.max(0, selectionStartIdx - 80), selectionStartIdx);
  const suffix = aggregatedText.substring(selectionEndIdx, Math.min(aggregatedText.length, selectionEndIdx + 80));

  return { text, prefix, suffix };
}

// Position and show the floating helper button
function handleSelectionChange(e) {
  setTimeout(() => {
    if (!ninaSettings.floatingButton) {
      hideFloatingButton();
      return;
    }

    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.toString().trim() === "") {
      hideFloatingButton();
      return;
    }

    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      hideFloatingButton();
      return;
    }

    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    if (rects.length === 0) {
      hideFloatingButton();
      return;
    }

    const rect = rects[0];
    const top = rect.top + window.scrollY - 45;
    const left = rect.left + window.scrollX + (rect.width / 2);

    if (floatingButton) {
      floatingButton.style.top = `${top}px`;
      floatingButton.style.left = `${left}px`;
      
      const btnRect = floatingButton.getBoundingClientRect();
      const halfWidth = btnRect.width ? btnRect.width / 2 : 50;
      
      floatingButton.style.left = `${Math.max(10, left - halfWidth)}px`;
      floatingButton.classList.add("visible");
    }
  }, 30);
}

function hideFloatingButton() {
  if (floatingButton) {
    floatingButton.classList.remove("visible");
  }
}

// Save active selection details, pre-fetching active project ID
function saveCurrentSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const text = selection.toString();
  if (text.trim() === "") return;

  let prefix = "";
  let suffix = "";
  try {
    const contextData = getSelectionData();
    if (contextData) {
      prefix = contextData.prefix;
      suffix = contextData.suffix;
    }
  } catch (err) {
    console.warn("Could not calculate selection context, saving text only:", err);
  }

  const id = "nina_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const url = window.location.href;
  const title = document.title || "Unbenannte Seite";
  const timestamp = Date.now();

  const meta = getPageMeta();

  // Load the current active project before saving the highlight
  chrome.storage.local.get({ activeProjectId: "proj_standard", highlights: [] }, (result) => {
    const activeId = result.activeProjectId || "proj_standard";
    const highlights = result.highlights || [];

    const newHighlight = {
      id,
      text,
      url,
      title,
      timestamp,
      projectId: activeId, // Associate with current active project!
      prefix,
      suffix,
      note: "",
      category: "",
      tags: [],
      author: meta.author,
      publishedDate: meta.publishedDate,
      siteName: meta.siteName,
      order: timestamp
    };

    const isDuplicate = highlights.some(h => h.text === text && (timestamp - h.timestamp) < 1000);
    if (isDuplicate) return;

    highlights.push(newHighlight);
    chrome.storage.local.set({ highlights }, () => {
      // Visually apply highlight locally
      findAndHighlight(text, prefix, suffix, id, "");

      window.getSelection().removeAllRanges();
      hideFloatingButton();
    });
  });
}

// Find a text sequence on page and wrap it in a highlight span
function findAndHighlight(searchText, prefix, suffix, id, category) {
  if (!searchText) return false;
  searchText = searchText.trim();
  if (searchText === "") return false;

  if (document.querySelector(`.nina-highlight-span[data-nina-id="${id}"]`)) {
    return true;
  }

  const body = document.body;
  const textNodes = [];
  let aggregatedText = "";

  const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode: function(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'textarea' || tag === 'noscript') {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.classList.contains('nina-highlight-span') || parent.id === 'nina-floating-highlighter') {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  }, false);

  let node;
  while (node = walk.nextNode()) {
    const textValue = node.nodeValue;
    const startIdx = aggregatedText.length;
    aggregatedText += textValue;
    textNodes.push({
      node: node,
      start: startIdx,
      end: startIdx + textValue.length
    });
  }

  // Find all matches of searchText
  let searchIdx = 0;
  const matches = [];
  while ((searchIdx = aggregatedText.indexOf(searchText, searchIdx)) !== -1) {
    matches.push(searchIdx);
    searchIdx += searchText.length;
  }

  if (matches.length === 0) {
    searchIdx = 0;
    const lowerAgg = aggregatedText.toLowerCase();
    const lowerSearch = searchText.toLowerCase();
    while ((searchIdx = lowerAgg.indexOf(lowerSearch, searchIdx)) !== -1) {
      matches.push(searchIdx);
      searchIdx += lowerSearch.length;
    }
  }

  if (matches.length === 0) return false;

  // Score matches
  let bestMatchIdx = matches[0];
  let highestScore = -1;

  for (const matchStart of matches) {
    const matchEnd = matchStart + searchText.length;
    const actualPrefix = aggregatedText.substring(Math.max(0, matchStart - 80), matchStart);
    const actualSuffix = aggregatedText.substring(matchEnd, Math.min(aggregatedText.length, matchEnd + 80));

    let score = 0;
    if (prefix) {
      let i = 1;
      while (i <= Math.min(prefix.length, actualPrefix.length)) {
        if (prefix[prefix.length - i] === actualPrefix[actualPrefix.length - i]) {
          score++;
        } else {
          break;
        }
        i++;
      }
    }
    if (suffix) {
      let i = 0;
      while (i < Math.min(suffix.length, actualSuffix.length)) {
        if (suffix[i] === actualSuffix[i]) {
          score++;
        } else {
          break;
        }
        i++;
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatchIdx = matchStart;
    }
  }

  // Wrap overlapping text nodes
  const targetStart = bestMatchIdx;
  const targetEnd = bestMatchIdx + searchText.length;
  const nodesToWrap = [];

  for (const item of textNodes) {
    if (item.end > targetStart && item.start < targetEnd) {
      const overlapStart = Math.max(item.start, targetStart);
      const overlapEnd = Math.min(item.end, targetEnd);
      nodesToWrap.push({
        node: item.node,
        startOffset: overlapStart - item.start,
        endOffset: overlapEnd - item.start
      });
    }
  }

  for (let i = nodesToWrap.length - 1; i >= 0; i--) {
    const { node: textNode, startOffset, endOffset } = nodesToWrap[i];
    const parent = textNode.parentNode;
    if (!parent) continue;

    const wrapper = document.createElement("span");
    wrapper.className = "nina-highlight-span";
    wrapper.setAttribute("data-nina-id", id);
    if (category) wrapper.setAttribute("data-cat", category);

    if (startOffset === 0 && endOffset === textNode.nodeValue.length) {
      parent.replaceChild(wrapper, textNode);
      wrapper.appendChild(textNode);
    } else {
      const matchedText = textNode.nodeValue.substring(startOffset, endOffset);
      const remainingTextAfter = textNode.nodeValue.substring(endOffset);
      textNode.nodeValue = textNode.nodeValue.substring(0, startOffset);

      wrapper.textContent = matchedText;

      const nextSibling = textNode.nextSibling;
      if (nextSibling) {
        parent.insertBefore(wrapper, nextSibling);
      } else {
        parent.appendChild(wrapper);
      }

      if (remainingTextAfter.length > 0) {
        const afterNode = document.createTextNode(remainingTextAfter);
        parent.insertBefore(afterNode, wrapper.nextSibling);
      }
    }
  }

  return true;
}

// Remove highlight span and restore original text node layout
function clearAllVisualHighlights() {
  const spans = document.querySelectorAll(".nina-highlight-span");
  spans.forEach(span => {
    const parent = span.parentNode;
    if (parent) {
      while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
      }
      parent.removeChild(span);
    }
  });
  document.body.normalize();
}

// Load and apply highlights matching active project
function loadSavedHighlights() {
  const currentUrl = window.location.href;
  chrome.storage.local.get({
    highlights: [],
    activeProjectId: "proj_standard"
  }, (result) => {
    const activeId = result.activeProjectId || "proj_standard";
    const highlights = result.highlights || [];
    
    // Clear currently rendered page highlights
    clearAllVisualHighlights();

    highlights.forEach(h => {
      // Show ONLY highlights belonging to active project
      if (h.projectId === activeId) {
        const cleanHUrl = h.url.split('#')[0].replace(/\/$/, "");
        const cleanCurrentUrl = currentUrl.split('#')[0].replace(/\/$/, "");

        if (cleanHUrl === cleanCurrentUrl) {
          findAndHighlight(h.text, h.prefix, h.suffix, h.id, h.category || "");
        }
      }
    });

    maybeScrollToHighlight();
  });
}

// Jump to a specific highlight when the page is opened via "Zur Stelle springen"
// (URL contains #nina=<id>).
let ninaJumped = false;
function maybeScrollToHighlight() {
  if (ninaJumped) return;
  const m = window.location.hash.match(/nina=([^&]+)/);
  if (!m) return;
  const id = decodeURIComponent(m[1]);
  const span = document.querySelector(`.nina-highlight-span[data-nina-id="${id}"]`);
  if (span) {
    ninaJumped = true;
    span.scrollIntoView({ behavior: "smooth", block: "center" });
    span.classList.add("nina-jump-flash");
    setTimeout(() => span.classList.remove("nina-jump-flash"), 1800);
  }
}

// Setup Event Listeners
document.addEventListener("mouseup", handleSelectionChange);
document.addEventListener("keyup", handleSelectionChange);

document.addEventListener("mousedown", (e) => {
  if (floatingButton && !floatingButton.contains(e.target)) {
    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideFloatingButton();
      }
    }, 100);
  }
});

// Watch for storage changes: re-render page highlights if highlights or active project swaps
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.highlights || changes.activeProjectId) {
      loadSavedHighlights();
    }
    if (changes.settings && changes.settings.newValue) {
      ninaSettings = { floatingButton: true, imageSave: true, ...changes.settings.newValue };
      if (!ninaSettings.floatingButton) hideFloatingButton();
      if (!ninaSettings.imageSave && typeof hideImageSaveButton === "function") hideImageSaveButton();
    }
  }
});

// Handle incoming messages from background (e.g. context menu triggers)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "visualizeLastSelection" && message.highlight) {
    const h = message.highlight;
    findAndHighlight(h.text, h.prefix, h.suffix, h.id, h.category || "");
    sendResponse({ success: true });
  } else if (message.action === "flashImageSrc" && message.srcUrl) {
    flashImageElement(message.srcUrl);
    sendResponse({ success: true });
  } else if (message.action === "getPageMeta") {
    sendResponse(getPageMeta());
  } else if (message.action === "saveSelectionCommand") {
    // Triggered by the keyboard shortcut
    saveCurrentSelection();
    sendResponse({ success: true });
  }
  return true;
});

// Image Save Hover Logic
let activeHoveredImage = null;
let imageSaveButton = null;
let imageButtonTimer = null;

function handleImageMouseOver(e) {
  if (!ninaSettings.imageSave) return;
  const el = e.target;
  if (el.tagName === "IMG") {
    // Ignore small icons/decorations
    const rect = el.getBoundingClientRect();
    if (rect.width < 50 || rect.height < 50) return;

    activeHoveredImage = el;
    showImageSaveButton(el);
  }
}

function handleImageMouseOut(e) {
  if (e.target.tagName === "IMG") {
    hideImageSaveButtonWithDelay();
  }
}

function showImageSaveButton(img) {
  if (!imageSaveButton) {
    imageSaveButton = document.createElement("button");
    imageSaveButton.id = "nina-image-highlighter";
    imageSaveButton.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 2L1 8l11 6 9-4.91V17h2V8L12 2z"/>
        <path d="M22 13.47l-10 5.46-10-5.46V18l10 5.5 10-5.5v-4.53z"/>
      </svg>
      Merken
    `;
    document.body.appendChild(imageSaveButton);

    imageSaveButton.addEventListener("mouseenter", () => {
      if (imageButtonTimer) clearTimeout(imageButtonTimer);
    });

    imageSaveButton.addEventListener("mouseleave", () => {
      hideImageSaveButtonWithDelay();
    });

    imageSaveButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (activeHoveredImage) {
        saveImageHighlight(activeHoveredImage);
      }
      hideImageSaveButton();
    });
  }

  if (imageButtonTimer) clearTimeout(imageButtonTimer);

  // Position at the top right of the image element
  const rect = img.getBoundingClientRect();
  const top = rect.top + window.scrollY + 8;
  const left = rect.left + rect.width + window.scrollX - 78;

  imageSaveButton.style.top = `${top}px`;
  imageSaveButton.style.left = `${left}px`;
  imageSaveButton.classList.add("visible");
}

function hideImageSaveButtonWithDelay() {
  if (imageButtonTimer) clearTimeout(imageButtonTimer);
  imageButtonTimer = setTimeout(() => {
    hideImageSaveButton();
  }, 400); // 400ms buffer for hover movement
}

function hideImageSaveButton() {
  if (imageSaveButton) {
    imageSaveButton.classList.remove("visible");
  }
  activeHoveredImage = null;
}

function saveImageHighlight(img) {
  const imageUrl = img.src;
  if (!imageUrl) return;

  const id = "nina_" + Math.random().toString(36).substring(2, 11) + "_" + Date.now();
  const url = window.location.href;
  const title = document.title || "Bildquelle";
  const timestamp = Date.now();

  chrome.storage.local.get({ activeProjectId: "proj_standard", highlights: [] }, (result) => {
    const activeId = result.activeProjectId || "proj_standard";
    const highlights = result.highlights || [];

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

    const isDuplicate = highlights.some(h => h.type === "image" && h.imageUrl === imageUrl && h.projectId === activeId);
    if (isDuplicate) return;

    highlights.push(newHighlight);
    chrome.storage.local.set({ highlights }, () => {
      flashImageElement(imageUrl);
    });
  });
}

function flashImageElement(srcUrl) {
  const imgs = document.querySelectorAll("img");
  let targetImg = null;
  for (const img of imgs) {
    if (img.src === srcUrl) {
      targetImg = img;
      break;
    }
  }

  if (targetImg) {
    targetImg.classList.add("nina-image-saved-effect");
    setTimeout(() => {
      targetImg.classList.remove("nina-image-saved-effect");
    }, 1200);
  }
}

// Setup Event Listeners
document.addEventListener("mouseover", handleImageMouseOver);
document.addEventListener("mouseout", handleImageMouseOut);

// Run Setup
initFloatingButton();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSavedHighlights);
} else {
  loadSavedHighlights();
}
window.addEventListener("load", loadSavedHighlights);
