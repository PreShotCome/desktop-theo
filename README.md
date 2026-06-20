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

- **Chat** — **live.** Threaded conversations in Firebase (project `data-55089`,
  `conversations/{id}/messages/`) — the *same* threads the phone/PWA use, so
  history is shared across devices. The bridge on your PC answers as the one
  shared Theo. Auto-opens the most recent thread; New chat + delete supported.
- **Code** — scratch buffer today; Monaco editor + agent file/shell/git tools later.
- **Brain** — 3D holographic point cloud generated from `brain.json`; click a
  section to light up its region and list its items.
- **Settings** — bridge URL/token + backend choice, persisted to disk.

## Chat prerequisites

Chat talks to Firestore directly (the bridge architecture, same as the Flutter
app — no HTTP endpoint). For Theo to answer:

1. The bridge must be running on the PC: `./bridge.ps1` in the Tech-Support repo.
2. The desktop app signs in to Firebase anonymously on launch (rules allow any
   authenticated client; Ian is the only user).

If you're offline or the bridge is down, you can still send — messages queue and
Theo answers once the bridge is back.

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
      theme.ts               # TS palette (Modern Glass) + Section type
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

## Auto-update

The app updates itself via `electron-updater`, reading from a dedicated Firebase
Hosting site (no GitHub token needed — it's a public static feed). On launch and
every 6h it checks for a newer version, downloads in the background, and installs
on quit.

### One-time setup (per machine that publishes releases)

```sh
npm i -g firebase-tools          # or use npx
firebase login
firebase hosting:sites:create theo-desktop-updates
```

That creates `https://theo-desktop-updates.web.app`. If the name is taken, pick
another and update it in **two** places: `publish.url` in `electron-builder.yml`
and the `updates` target in `.firebaserc`. The target mapping
(`updates` → `theo-desktop-updates`) is already wired in `.firebaserc`.

> The **first** installed build must already include this publish config (it
> does, from this version on). Install it once manually; every later version
> auto-updates.

### Cutting a release

```sh
npm version patch          # bump the version (updater compares versions)
npm run release            # build installer + latest.yml, stage to release/
npm run deploy:update      # firebase deploy --only hosting:updates
```

Installed apps pick it up on their next launch. `release/` holds only the three
files the updater needs (`latest.yml`, the `.exe`, and the `.blockmap` for small
differential downloads) — not the whole `dist/` tree.

## Security posture

`nodeIntegration: false`, `contextIsolation: true`. The renderer can only reach
the main process through the audited `window.theo` surface defined in
`src/preload/index.ts`. External links open in the OS browser, never in-app.

## Roadmap

1. ✅ **Shell** — installable Windows app, four sections, Modern Glass UI.
2. ✅ **Chat** — live threaded chat via Firestore (shared with the phone).
3. ✅ **Brain** — 3D holographic point cloud with section→region highlighting.
4. ✅ **Auto-update** — self-updating via Firebase Hosting feed.
5. **Code** — Monaco editor + Theo's coding tools (file / shell / git). ← next
