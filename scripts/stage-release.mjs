// Copies just the auto-update artifacts from dist/ into release/ (the Firebase
// Hosting public dir), so `firebase deploy` uploads only what the updater needs
// — not the whole ~hundreds-of-MB dist/win-unpacked tree.
//
// Publishes: latest.yml (the update manifest), the *.exe installer, and the
// *.blockmap (enables small differential downloads).
import { mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const OUT = 'release'

const wanted = (name) =>
  name === 'latest.yml' || name.endsWith('.exe') || name.endsWith('.blockmap')

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

let files
try {
  files = readdirSync(DIST)
} catch {
  console.error(`No ${DIST}/ folder — run the build first (npm run release).`)
  process.exit(1)
}

const picked = files.filter(wanted)
if (!picked.some((f) => f === 'latest.yml')) {
  console.error('latest.yml not found in dist/ — did electron-builder run with the publish config?')
  process.exit(1)
}

for (const f of picked) {
  copyFileSync(join(DIST, f), join(OUT, f))
  console.log('staged', f)
}
console.log(`\n${picked.length} file(s) ready in ${OUT}/ — now: firebase deploy --only hosting:updates`)
