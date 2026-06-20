import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { initAutoUpdate } from './updater'

// In dev, use a separate userData dir so a running *installed* build can't lock
// the cache/IndexedDB this dev instance needs — that collision is what causes
// the "Unable to move the cache: Access is denied" + quota_database errors when
// both run at once. The installed app keeps the default "theo-desktop" folder.
if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('appData'), 'theo-desktop-dev'))
}

// ---------------------------------------------------------------------------
// Settings persistence
// Stored as a single JSON file under the OS user-data dir so it survives
// reinstalls of the app bundle. This is where the Theo bridge URL / token
// and backend choice live until we wire the real bridge client.
// ---------------------------------------------------------------------------

type Settings = Record<string, unknown>

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

async function readSettings(): Promise<Settings> {
  try {
    const raw = await fs.readFile(settingsPath(), 'utf-8')
    return JSON.parse(raw) as Settings
  } catch {
    return {}
  }
}

async function writeSettings(data: Settings): Promise<Settings> {
  await fs.writeFile(settingsPath(), JSON.stringify(data, null, 2), 'utf-8')
  return data
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 920,
    minHeight: 600,
    show: false,
    title: 'Theo Desktop',
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Open external links in the OS browser, never in-app.
  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev-server URL in development; load the built
  // file in production.
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('settings:get', () => readSettings())
  ipcMain.handle('settings:set', (_event, data: Settings) => writeSettings(data))

  createWindow()
  initAutoUpdate()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Windows-only target, but keep the standard cross-platform quit guard.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
