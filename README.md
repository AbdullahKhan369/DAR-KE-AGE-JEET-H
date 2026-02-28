# Smart Sticky Pro

Smart Sticky Pro is a Windows-focused Electron sticky-notes app with movable/resizable multi-note windows and local JSON persistence.

## Features

- Unlimited sticky notes with saved history (date + day)
- **Floating notes board**: every note is draggable and resizable
- Per-note controls:
  - Title, mode selector, theme selector
  - Plus button for quick new note
  - Three-dots menu for header/footer colors + open notes list action
  - Footer on each note: `Developed by Abdullah khan`
- Rich text controls in all modes: **Bold / Italic / Underline**
- Modes:
  - **Normal**: rich text note
  - **To-Ask**: checklist (red default, double-click to green complete) + rich text
  - **Leads Counter**: month field, add-lead modal, and live Part B/ELSE/Atena scoreboard
- Theme controls:
  - Main panel theme: light/dark
  - Per-note light/dark theme (body switches white/dark gray)
- Startup behavior: **Pin to Start** (open app with Windows)

## Google Sync

UI and secure integration points are included. Real cross-device sync requires actual OAuth + Firebase/Google Drive credentials in deployment.

## Files

- `main.js` Electron main process and IPC handlers
- `preload.js` secure bridge (`window.stickyApi`)
- `renderer.js` note rendering, drag/resize, mode logic, and persistence flow
- `index.html` app shell and modal
- `styles.css` modern responsive styling

## Run

```bash
npm install
npm run start
```

## Build Windows executable

```bash
npm install
npm run build:win
```

Build output is generated in `dist/`.
