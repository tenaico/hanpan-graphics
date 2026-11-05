// node scripts/verify.mjs <photo|illust> [--baseline]: checks out/<app>/site and the patched source
// it was built from (work/<app>):
//   1. brand scan of the site (every file but the licence and notice texts)
//   2. brand scan of the patched source: non-comment lines of the translations, non-test Rust in
//      crates/, Rust and HTML in apps/ (strings there can reach the app compressed or generated,
//      where the byte scan of the site cannot see them), reported as file:line
//   3. every licence path the site's NOTICE / ATTRIBUTION.md / ASSETS.md names is in the site
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanBrand, scanSource, isSourceToScan, isShippedText, CREDIT } from './lib/brand.mjs'
import { missingLicenceRefs } from './lib/licences.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const app = process.argv[2]
if (!['photo', 'illust'].includes(app)) {
  console.error('usage: node scripts/verify.mjs <photo|illust> [--baseline]')
  process.exit(2)
}
const site = join(ROOT, 'out', app, 'site')
const source = join(ROOT, 'work', app)
const SKIP_DIRS = new Set(['.git', 'target', 'node_modules', 'dist'])
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (SKIP_DIRS.has(e.name) ? [] : walk(join(dir, e.name))) : [join(dir, e.name)],
  )
const rel = (base, f) => relative(base, f).split(/[\\/]/).join('/')

let failed = false
const report = (what, lines) => {
  if (lines.length) {
    console.log(lines.slice(0, 40).join('\n'))
    if (lines.length > 40) console.log(`… and ${lines.length - 40} more`)
    console.log(`[${app}] ${what}: ${lines.length} finding(s)`)
    failed = true
  } else console.log(`[${app}] ${what}: clean`)
}

const siteHits = walk(site)
  .filter((f) => !isShippedText(rel(site, f)))
  .flatMap((f) => scanBrand(rel(site, f), readFileSync(f), [CREDIT[app]]))
const siteLines = siteHits.map((h) => `${h.file}@${h.offset}: ${h.match}`)
if (process.argv.includes('--baseline')) writeFileSync(join(ROOT, 'out', app, 'brand-baseline.txt'), siteLines.join('\n') + '\n')
report('brand scan (site)', siteLines)

if (!existsSync(join(source, 'apps'))) {
  console.log(`[${app}] brand scan (source): ${source} is not a checkout; build first`)
  failed = true
} else {
  const srcHits = walk(source)
    .filter((f) => isSourceToScan(rel(source, f)))
    .flatMap((f) => scanSource(rel(source, f), readFileSync(f, 'utf8'), [CREDIT[app]]))
  report('brand scan (source)', srcHits.map((h) => `${h.file}:${h.line}: ${h.match}`))
}

report('licence texts named by NOTICE/ATTRIBUTION.md/ASSETS.md', missingLicenceRefs(site).map((m) => `missing ${m}`))

if (failed) process.exit(1)
