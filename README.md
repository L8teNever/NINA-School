# NINA School - Chrome Extension

Ein **wissenschaftlicher Quellen-Manager** für Schularbeiten. Markiere Text auf Webseiten, speichere ihn mit Quellenangaben und verwalte alle deine Zitate übersichtlich.

## 🎯 Features

- ✅ **Text-Markierung**: Markiere Text auf jeder Webseite
- ✅ **Automatische Quellenangaben**: URL, Seitentitel, Timestamp werden erfasst
- ✅ **Projekt-Management**: Organisiere Zitate in verschiedene Projekte
- ✅ **Notizen**: Füge persönliche Notizen zu jedem Zitat hinzu
- ✅ **Export**: Exportiere als Markdown oder Quellenverzeichnis
- ✅ **Dark Mode**: Modernes, dunkles Design mit Cyan & Lime-Grün Akzenten

## 📂 Projektstruktur

```
NINA-School/
├── manifest.json              # Extension Konfiguration
├── background.js              # Service Worker
├── content.js                 # Content Script (auf Webseiten)
├── content.css                # Highlight-Styles
├── README.md                  # Diese Datei
│
├── icons/
│   └── logo.svg              # Logo (SVG, skalierbar)
│
├── sidepanel/
│   ├── sidepanel.html        # Sidebar UI
│   ├── sidepanel.css         # Sidebar Styles
│   └── sidepanel.js          # Sidebar Logik
│
└── fullpage/
    ├── fullpage.html         # Vollansicht UI
    ├── fullpage.css          # Vollansicht Styles
    └── fullpage.js           # Vollansicht Logik
```

## 🚀 Installation

1. Lade die Extension in Chrome:
   - Öffne `chrome://extensions/`
   - Aktiviere "Entwicklermodus" (oben rechts)
   - Klicke "Erweiterung laden..."
   - Wähle den Projektordner

2. Extension wird im Toolbar angezeigt
3. Klick auf Icon um Sidebar zu öffnen

## 💻 Verwendung

### Text speichern
- Markiere Text auf einer Webseite
- Klick auf "Zu NINA" Button oder Rechtsklick-Menü
- Text wird gespeichert und hervorgehoben

### Verwaltung
- **Sidebar**: Schnelle Übersicht der Quellen
- **Vollansicht**: Klick "Vollansicht öffnen" für komplette Verwaltung
  - Alle Zitate mit Notiz-Editor
  - Suche & Sortierung
  - Export (Markdown + Bibliography)
  - Projekt-Management

## 🎨 Design

- **Color Scheme**:
  - Background: `#0f0f0f` / `#1a1a1a`
  - Accent Cyan: `#4dd9d9`
  - Accent Lime: `#c5f135`
  - Text: `#e8e8e8`

- **Typography**: Inter Font
- **Radius**: 12px Cards, 8px Buttons

## 📦 Technologie

- **Manifest v3** (moderner Chrome Standard)
- **Chrome Storage API** (offline-fähig)
- **Vanilla JavaScript** (keine Dependencies)
- **CSS3** (Grid, Flexbox)

## 📝 Lizenz

Privat
