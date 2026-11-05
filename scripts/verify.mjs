// node scripts/verify.mjs <photo|illust> [--baseline]: the brand scan of out/<app>/site.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scanBrand, CREDIT } from './lib/brand.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const app = process.argv[2]
if (!['photo', 'illust'].includes(app)) {
  console.error('usage: node scripts/verify.mjs <photo|illust> [--baseline]')
  process.exit(2)
}
const site = join(ROOT, 'out', app, 'site')
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
// licence and notice texts name their authors; the scan is about what the app shows and links to
const SHIPPED_TEXT = /(^|[\/])(LICENSE-[A-Z]+|NOTICE|ATTRIBUTION\.md|ASSETS\.md|HANPAN-CHANGES\.md)$|[\/]licenses[\/]/
const hits = walk(site)
  .filter((f) => !SHIPPED_TEXT.test(relative(site, f)))
  .flatMap((f) => scanBrand(relative(site, f), readFileSync(f), [CREDIT[app]]))
const lines = hits.map((h) => `${h.file}@${h.offset}: ${h.match}`)
if (process.argv.includes('--baseline')) writeFileSync(join(ROOT, 'out', app, 'brand-baseline.txt'), lines.join('\n') + '\n')
if (hits.length) {
  console.log(lines.slice(0, 40).join('\n'))
  console.log(`[${app}] brand scan: ${hits.length} finding(s)`)
  process.exit(1)
}
console.log(`[${app}] brand scan: clean`)
