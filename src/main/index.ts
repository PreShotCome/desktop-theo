import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { promises as fs } from 'fs'
import { spawn, execFile, type ChildProcess } from 'child_process'
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
// Theo backend lifecycle
// Spawn the Tech-Support backend (theo-backend.ps1: Ollama + Script Bot +
// conversational bridge, headless) when the app starts, and tear it down on
// quit — so the user never runs bridge.ps1 by hand. Windows-only; no-op
// elsewhere. The folder is resolved from THEO_TECHSUPPORT_DIR, then the saved
// setting, then a sensible default.
// ---------------------------------------------------------------------------

const DEFAULT_TECH_SUPPORT_DIR = 'C:\\src\\Tech-Support'

type BackendStatus = 'starting' | 'online' | 'stopped' | 'error' | 'unsupported'
let backendStatus: BackendStatus = 'stopped'
let backend: ChildProcess | null = null

function setBackendStatus(s: BackendStatus): void {
  backendStatus = s
  mainWindow?.webContents.send('backend:status', s)
}

function resolveTechSupportDir(settings: Settings): string {
  const envDir = process.env['THEO_TECHSUPPORT_DIR']
  if (envDir) return envDir
  const setDir = settings.techSupportDir
  if (typeof setDir === 'string' && setDir.trim()) return setDir.trim()
  return DEFAULT_TECH_SUPPORT_DIR
}

const WEB_SANDBOX_MODES = ['off', 'stub', 'record', 'replay', 'corpus']
function resolveWebSandbox(settings: Settings): string {
  const v = settings.webSandbox
  return typeof v === 'string' && WEB_SANDBOX_MODES.includes(v) ? v : 'off'
}

function startBackend(techSupportDir: string, webSandbox: string): void {
  if (process.platform !== 'win32') {
    setBackendStatus('unsupported')
    return
  }
  if (backend) return // already running
  const script = join(techSupportDir, 'theo-backend.ps1')
  setBackendStatus('starting')
  backend = spawn(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script],
    {
      cwd: techSupportDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      // Pass the offline-web sandbox mode through to the bridge's web tools.
      env: { ...process.env, THEO_WEB_SANDBOX: webSandbox }
    }
  )
  backend.stdout?.on('data', (d) => {
    const line = d.toString().trim()
    console.log('[theo-backend]', line)
    // The conversational bridge prints this once it's ready for messages.
    if (/Listening on collection_group/i.test(line)) setBackendStatus('online')
  })
  backend.stderr?.on('data', (d) => console.error('[theo-backend]', d.toString().trim()))
  backend.on('exit', (code) => {
    console.log('[theo-backend] exited', code)
    backend = null
    setBackendStatus('stopped')
  })
  backend.on('error', (e) => {
    console.error('[theo-backend] spawn failed', e)
    setBackendStatus('error')
  })
}

function stopBackend(): void {
  if (backend?.pid) {
    // taskkill /T kills the whole tree (powershell -> python/ollama); a plain
    // kill() would orphan the python processes.
    execFile('taskkill', ['/PID', String(backend.pid), '/T', '/F'])
    backend = null
  }
}

// ---------------------------------------------------------------------------
// Bridge HTTP (python/agent/bridges/local_storage.py, on :8765)
//
// Reached from the MAIN process on purpose: the renderer is context-isolated
// and a direct fetch to localhost trips CORS, but Node here has no such limit.
// The token is the tailnet-only shared bridge token.
// ---------------------------------------------------------------------------

const BRIDGE_BASE = 'http://localhost:8765'
const BRIDGE_TOKEN = 'bumhrfpo4678lwveikadn0q15tscxg2y'

async function bridgeGetJson<T>(path: string): Promise<T> {
  const resp = await fetch(`${BRIDGE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${BRIDGE_TOKEN}` }
  })
  if (!resp.ok) throw new Error(`bridge GET ${path} failed (${resp.status})`)
  return (await resp.json()) as T
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

app.whenReady().then(async () => {
  ipcMain.handle('app:getVersion', () => app.getVersion())
  ipcMain.handle('settings:get', () => readSettings())
  ipcMain.handle('settings:set', (_event, data: Settings) => writeSettings(data))
  ipcMain.handle('backend:getStatus', () => backendStatus)

  // Image upload — the renderer hands us the bytes and we POST them to the
  // bridge's local file server (python/agent/bridges/local_storage.py), which
  // stores them and serves them back. Done in the MAIN process on purpose: the
  // renderer is context-isolated and a direct fetch to localhost:8765 trips
  // CORS, but Node here has no such limit. Returns the public URL (token baked
  // into the query so Image.src can GET it); the composer drops that into the
  // message as `![image](url)` and the bridge captions it for Theo to "see".
  // Brain tab — the association graph, and the real activation events emitted
  // by vault_recall every time Theo actually remembers something.
  ipcMain.handle('brain:graph', () => bridgeGetJson('/brain/graph'))
  ipcMain.handle('brain:activity', (_event, since: number) =>
    bridgeGetJson(`/brain/activity?since=${Math.max(0, Math.floor(since) || 0)}`)
  )

  ipcMain.handle(
    'image:upload',
    async (_event, payload: { bytes: Uint8Array; contentType?: string }): Promise<string> => {
      const token = BRIDGE_TOKEN
      const base = BRIDGE_BASE
      const type = payload.contentType || 'image/jpeg'
      const ext = type.includes('png')
        ? 'png'
        : type.includes('gif')
          ? 'gif'
          : type.includes('webp')
            ? 'webp'
            : 'jpg'
      const name = `desktop_${Date.now()}_${Math.floor(Math.random() * 1e6)}.${ext}`
      const url = `${base}/chat_images/${name}`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': type },
        body: Buffer.from(payload.bytes)
      })
      if (resp.status !== 200 && resp.status !== 201) {
        throw new Error(`bridge image upload failed (${resp.status})`)
      }
      return `${url}?t=${encodeURIComponent(token)}`
    }
  )

  const settings = await readSettings()

  createWindow()
  initAutoUpdate()
  startBackend(resolveTechSupportDir(settings), resolveWebSandbox(settings))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Tear the backend down on quit so python/ollama don't linger.
app.on('before-quit', stopBackend)

// Windows-only target, but keep the standard cross-platform quit guard.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
