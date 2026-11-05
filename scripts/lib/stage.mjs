// The site folder Hanpan serves: the web build plus everything its licences ask to ship.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOTICE_FILES, licenceRefs } from './licences.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const REQUIRED = ['LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE']
const OPTIONAL = ['ATTRIBUTION.md', 'ASSETS.md']
const LICENCE_NAME = /^(OFL|LICEN[CS]E|[\w-]+_LICEN[CS]E)[\w.-]*$/i

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    : []

/**
 * The upstream licence texts the site carries, as paths relative to the checkout: every one the
 * notice files name, plus every licence text under assets/** and crates/<crate>/data/**.
 * A named path the checkout lacks is an error.
 */
function upstreamLicences(app, upstream) {
  const named = NOTICE_FILES.filter((f) => existsSync(join(upstream, f))).flatMap((f) =>
    licenceRefs(readFileSync(join(upstream, f), 'utf8')),
  )
  const gone = named.filter((p) => !existsSync(join(upstream, p)))
  if (gone.length) throw new Error(`${app}: the notice files name licences the checkout lacks: ${gone.join(', ')}`)
  const crates = existsSync(join(upstream, 'crates'))
    ? readdirSync(join(upstream, 'crates')).map((c) => join(upstream, 'crates', c, 'data'))
    : []
  const found = [join(upstream, 'assets'), ...crates]
    .flatMap(walk)
    .filter((f) => LICENCE_NAME.test(f.split(/[\\/]/).pop()))
    .map((f) => relative(upstream, f).split(/[\\/]/).join('/'))
  return [...new Set([...named, ...found])].sort()
}

/**
 * out/<app>/site: work/<app>/dist/web, the upstream licence files, the licence texts the upstream
 * notice files name (at the same relative path, so those paths resolve in the site), every licence text in
 * craft-fonts (licenses/craft-fonts/<family>/…), CHANGES-<app>.md as HANPAN-CHANGES.md and
 * `extras` ({ from, to } with `to` relative to the site). Returns the site path.
 */
export function stageSite(app, workDir, outDir, extras = []) {
  const upstream = join(workDir, app)
  const site = join(outDir, app, 'site')
  rmSync(site, { recursive: true, force: true })
  mkdirSync(site, { recursive: true })
  cpSync(join(upstream, 'dist', 'web'), site, { recursive: true })
  for (const f of REQUIRED) {
    if (!existsSync(join(upstream, f))) throw new Error(`${app}: upstream ${f} is missing`)
    cpSync(join(upstream, f), join(site, f))
  }
  for (const f of OPTIONAL) if (existsSync(join(upstream, f))) cpSync(join(upstream, f), join(site, f))
  if (existsSync(join(upstream, 'licenses'))) cpSync(join(upstream, 'licenses'), join(site, 'licenses'), { recursive: true })
  for (const p of upstreamLicences(app, upstream)) {
    mkdirSync(dirname(join(site, p)), { recursive: true })
    cpSync(join(upstream, p), join(site, p))
  }
  const fonts = join(workDir, 'craft-fonts', 'fonts')
  for (const family of readdirSync(fonts, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    for (const f of readdirSync(join(fonts, family.name)).filter((n) => /^(OFL|LICEN[CS]E).*\.txt$/i.test(n))) {
      const to = join(site, 'licenses', 'craft-fonts', family.name, f)
      mkdirSync(dirname(to), { recursive: true })
      cpSync(join(fonts, family.name, f), to)
    }
  }
  cpSync(join(REPO_ROOT, `CHANGES-${app}.md`), join(site, 'HANPAN-CHANGES.md'))
  for (const { from, to } of extras) {
    mkdirSync(dirname(join(site, to)), { recursive: true })
    cpSync(from, join(site, to))
  }
  return site
}
