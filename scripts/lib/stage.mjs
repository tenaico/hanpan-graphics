// The site folder Hanpan serves: the web build plus everything its licences ask to ship.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const REQUIRED = ['LICENSE-MIT', 'LICENSE-APACHE', 'NOTICE']
const OPTIONAL = ['ATTRIBUTION.md', 'ASSETS.md']

/**
 * out/<app>/site: work/<app>/dist/web, the upstream licence files, every licence text in
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
