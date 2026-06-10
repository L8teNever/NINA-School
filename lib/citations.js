// NINA School - Zitier-Bibliothek
// Erzeugt Quellenverzeichnis-Einträge und In-Text-Belege in mehreren Stilen.
// Genutzt von fullpage.js und sidepanel.js (als window.NinaCite).

(function () {
  const STYLES = {
    apa: "APA",
    mla: "MLA",
    harvard: "Harvard",
    de: "Deutsche Zitierweise"
  };

  const MONTHS_DE = ["Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember"];

  function parseDate(value) {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // Publikationsdatum (falls erfasst), sonst null
  function pubDate(h) {
    return parseDate(h.publishedDate);
  }

  function year(h) {
    const d = pubDate(h);
    return d ? d.getFullYear() : null;
  }

  // Abrufdatum aus dem Speicherzeitpunkt
  function accessed(h) {
    return new Date(h.timestamp || Date.now());
  }

  function fmtDE(d) {
    if (!d) return "";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  }

  function fmtLongDE(d) {
    if (!d) return "";
    return `${d.getDate()}. ${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
  }

  function author(h) {
    return (h.author && h.author.trim()) ? h.author.trim() : "";
  }

  function site(h) {
    if (h.siteName && h.siteName.trim()) return h.siteName.trim();
    try {
      return new URL(h.url).hostname.replace(/^www\./, "");
    } catch (e) {
      return "";
    }
  }

  function title(h) {
    if (h.type === "image") return h.title || "Bildquelle";
    if (h.type === "file") return h.fileName || h.title || "Datei";
    return h.title || "Unbenannte Seite";
  }

  // Print sources (books) get no URL / access date.
  function isPrint(h) {
    return h.sourceType === "book";
  }

  // Turn "12" into "S. 12"; leave "S. 12", "Abs. 3", "f." etc. untouched.
  function normalizePage(value) {
    if (!value) return "";
    const v = String(value).trim();
    if (!v) return "";
    return /^[0-9][0-9\s.\-–ff]*$/.test(v) ? `S. ${v}` : v;
  }

  // ===== Vollständiger Quellenverzeichnis-Eintrag =====
  // includeDate (default true) steuert, ob das Abrufdatum mit ausgegeben wird.
  function formatReference(h, style, includeDate) {
    if (h.type === "idea") return ""; // Eigene Notizen sind keine Quelle
    if (includeDate === undefined) includeDate = true;
    const a = author(h);
    const s = site(h);
    const t = title(h);
    const print = isPrint(h);
    if (print) includeDate = false; // Bücher: kein Abrufdatum
    const url = (!print && h.url && !h.url.startsWith("Lokal:")) ? h.url : "";
    const y = year(h);
    const acc = accessed(h);

    switch (style) {
      case "mla": {
        let out = "";
        if (a) out += `${a}. `;
        out += `"${t}." `;
        if (s) out += `${s}, `;
        const pd = pubDate(h);
        if (pd) out += `${fmtLongDE(pd)}, `;
        if (url) out += `${url}`;
        if (includeDate) out += `${url ? ". " : ""}Zugriff am ${fmtLongDE(acc)}`;
        return out.trim().replace(/[.,\s]*$/, "") + ".";
      }
      case "harvard": {
        const auth = a || s || "o.V.";
        const yr = y || "o.J.";
        let out = `${auth} (${yr}) ${t}.`;
        if (url) out += ` Verfügbar unter: ${url}`;
        if (includeDate) out += ` (Abgerufen am: ${fmtDE(acc)})`;
        return out.replace(/\s*$/, "") + ".";
      }
      case "de": {
        // Deutsche Zitierweise (Internetquelle)
        let out = "";
        if (a) out += `${a}: `;
        out += `${t}.`;
        if (s) out += ` ${s}.`;
        if (url) out += ` URL: ${url}`;
        if (includeDate) out += ` (Abgerufen am ${fmtDE(acc)})`;
        return out.replace(/\s*$/, "") + ".";
      }
      case "apa":
      default: {
        const auth = a || s || "o.V.";
        const yr = y ? `(${y})` : "(o.J.)";
        let out = `${auth} ${yr}. ${t}.`;
        if (s && s !== auth) out += ` ${s}.`;
        if (url) out += ` ${url}`;
        return out;
      }
    }
  }

  // ===== In-Text-Beleg / Kurzbeleg =====
  function formatInText(h, style) {
    if (h.type === "idea") return "";
    const a = author(h);
    const s = site(h);
    const who = a || s || "o.V.";
    const y = year(h) || "o.J.";
    const pg = normalizePage(h.page);
    const pagePart = pg ? `, ${pg}` : "";
    const paraphrase = h.quoteType === "paraphrase";

    switch (style) {
      case "mla": {
        const core = a ? a : `"${title(h)}"`;
        const inner = `${core}${pg ? ` ${pg.replace(/^S\.\s*/, "")}` : ""}`;
        return `(${paraphrase ? "vgl. " : ""}${inner})`;
      }
      case "de": {
        // Fußnoten-Stil; paraphrasiert mit "Vgl."
        const ref = formatReference(h, "de");
        const base = pg ? ref.replace(/\.?$/, `, ${pg}.`) : ref;
        return paraphrase ? `Vgl. ${base}` : base;
      }
      case "harvard":
      case "apa":
      default:
        return `(${paraphrase ? "vgl. " : ""}${who}, ${y}${pagePart})`;
    }
  }

  window.NinaCite = { STYLES, formatReference, formatInText };
})();
