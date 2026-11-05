// node scripts/build.mjs <photo|illust>: fetch the pinned upstream, apply our patches, build the
// web app with Trunk, stage the site and zip it with its SHA-256 into out/.
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPins, artifactName } from './lib/pins.mjs'
import { checkoutPinned } from './lib/upstream.mjs'
import { patchList, applyPatches } from './lib/patches.mjs'
import { stageSite } from './lib/stage.mjs'
import { zipDir } from './lib/zip.mjs'
import { sha256File, sha256Line } from './lib/hash.mjs'
import { siteExtras } from './lib/extras.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const app = process.argv[2]
if (!['photo', 'illust'].includes(app)) {
  console.error('usage: node scripts/build.mjs <photo|illust>')
  process.exit(2)
}
const pins = readPins(join(ROOT, 'pins.json'))
const work = join(ROOT, 'work')
const out = join(ROOT, 'out')
const upstream = join(work, app)

console.log(`[${app}] ${pins[app].repo} ${pins[app].tag}`)
checkoutPinned(pins[app], upstream)
checkoutPinned({ repo: pins.craftFonts.repo, commit: pins.craftFonts.commit }, join(work, 'craft-fonts'))
const patches = patchList(app)
applyPatches(upstream, patches)
console.log(`[${app}] patches: ${patches.length ? patches.map((p) => p.split(/[\/]/).pop()).join(', ') : 'none'}`)

const env = { ...process.env, CARGO_TARGET_DIR: join(work, 'target', app) }
env.PATH = [join(homedir(), '.cargo', 'bin'), env.PATH ?? env.Path].join(delimiter)
if (app === 'illust') {
  // VectorCraft's post-build hook copies the fonts it fetches from craft-fonts
  env.CRAFT_FONTS_DIR = join(work, 'craft-fonts')
  env.CRAFT_FONTS_REQUIRED = '1'
}
const started = Date.now()
execFileSync('trunk', ['build', '--release'], {
  cwd: join(upstream, pins[app].webApp),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
console.log(`[${app}] trunk build: ${Math.round((Date.now() - started) / 1000)}s`)

const site = stageSite(app, work, out, siteExtras(app, work))
const name = artifactName(app, pins)
await zipDir(site, join(out, name))
writeFileSync(join(out, `${name}.sha256`), sha256Line(sha256File(join(out, name)), name))
console.log(`[${app}] ${join(out, name)}`)
