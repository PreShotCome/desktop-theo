# Theo Desktop

A fresh, Windows-only desktop app for **Theo** — built clean rather than
converted from the existing agent. Electron + React + TypeScript. The first
milestone is a workable, installable shell with four sections; Theo's chat,
coding tools, and brain explorer get wired in afterward.

## Stack

| Layer | Tech |
|---|---|
| Shell | Electron 34 |
| UI | React 18 + TypeScript |
| Build | electron-vite (Vite under the hood) |
| Packaging | electron-builder → NSIS installer (`.exe`) |
| Target | Windows only (for now) |

## Sections (current shell)

- **Chat** — message UI, ready to connect to the Theo bridge.
- **Code** — scratch buffer today; Monaco editor + agent file/shell/git tools later.
- **Brain** — explorer for identity/memory (IDENTITY.md, `brain.json`).
- **Settings** — bridge URL/token + backend choice, persisted to disk.

## Layout

```
electron.vite.config.ts      # main / preload / renderer build config
electron-builder.yml         # Windows NSIS installer config
src/
  main/index.ts              # Electron main process + settings IPC
  preload/index.ts           # contextBridge surface (window.theo)
  renderer/
    index.html
    src/
      App.tsx                # shell: sidebar + section switch
      theme.ts               # TS palette (TerminalTron) + Section type
      styles.css
      components/Sidebar.tsx
      sections/              # Chat / Code / Brain / Settings
```

## Develop

```sh
npm install
npm run dev        # launches Electron with HMR
```

## Type-check

```sh
npm run typecheck
```

## Build the Windows installer

```sh
npm run build:win
```

Produces `dist/Theo Desktop-<version>-setup.exe` (one-click off; lets the user
pick the install dir; creates a desktop shortcut).

> **Note:** the NSIS installer must be built **on Windows** (or with wine).
> `npm run build` (the renderer/main bundling step) is cross-platform and runs
> anywhere; only the final `electron-builder --win` packaging needs Windows.

## Security posture

`nodeIntegration: false`, `contextIsolation: true`. The renderer can only reach
the main process through the audited `window.theo` surface defined in
`src/preload/index.ts`. External links open in the OS browser, never in-app.

## Roadmap

1. **Shell** — installable app with the four sections. ← you are here
2. **Bridge client** — Settings → connect Chat to the running Theo bridge.
3. **Brain** — render `brain.json` (categories → axioms).
4. **Code** — Monaco editor + Theo's coding tools (file / shell / git).
