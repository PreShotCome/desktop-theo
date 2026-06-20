// Auto-update via electron-updater. The feed URL (a dedicated Firebase Hosting
// site) is baked into app-update.yml at build time from the `publish` block in
// electron-builder.yml — no token needed for a public static host.
//
// Only runs in a packaged build; in dev there is no app-update.yml and the
// updater would throw, so we no-op.
import { app } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

const SIX_HOURS = 6 * 60 * 60 * 1000

export function initAutoUpdate(): void {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log(`[update] available: ${info.version}`)
  })
  autoUpdater.on('update-not-available', () => {
    console.log('[update] up to date')
  })
  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[update] downloaded ${info.version} — will install on quit`)
  })
  autoUpdater.on('error', (err) => {
    console.error('[update] error:', err == null ? 'unknown' : (err.stack || err).toString())
  })

  // Check on launch, then periodically while the app stays open.
  void autoUpdater.checkForUpdatesAndNotify()
  setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify()
  }, SIX_HOURS)
}
