// node scripts/smoke.mjs --app <photo|illust> --site <dir> --checks a,b [--query "<q>"] [--renderer auto|webgl|cpu]
// Runs the named checks against the site in a hidden Electron window; exit 1 when one fails.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPins } from './lib/pins.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

const args = {}
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[i + 1] ?? ''
}
if (!['photo', 'illust'].includes(args.app) || !args.site || !args.checks) {
  console.error('usage: node scripts/smoke.mjs --app <photo|illust> --site <dir> --checks a,b [--query q] [--renderer r]')
  process.exit(2)
}

const pins = readPins(resolve(ROOT, 'pins.json'))
const params = new URLSearchParams(args.query ?? '')
if (args.renderer && args.renderer !== 'auto') params.set(args.renderer, '')
const opts = {
  app: args.app,
  global: pins[args.app].global,
  site: resolve(args.site),
  out: resolve(ROOT, 'out', args.app),
  checks: args.checks.split(',').filter(Boolean),
  // flags without a value (?cpu) keep their bare form
  query: params.toString().replace(/=(&|$)/g, '$1'),
}

const electron = createRequire(import.meta.url)('electron')
const { ELECTRON_RUN_AS_NODE: _drop, ...env } = process.env
const flags = process.platform === 'linux' ? ['--no-sandbox'] : []
const r = spawnSync(electron, [...flags, resolve(ROOT, 'scripts', 'smoke-main.cjs')], {
  env: { ...env, SMOKE_OPTS: JSON.stringify(opts) },
  encoding: 'utf8',
  timeout: 15 * 60 * 1000,
})

const results = (r.stdout ?? '')
  .split('\n')
  .filter((l) => l.startsWith('SMOKE '))
  .map((l) => JSON.parse(l.slice(6)))
for (const res of results) console.log(JSON.stringify(res))
const failed = results.filter((x) => !x.ok).map((x) => x.check)
const missing = opts.checks.filter((c) => !results.some((x) => x.check === c))
if (r.status !== 0 || failed.length || missing.length) {
  if (r.stderr) console.error(r.stderr.split('\n').slice(-15).join('\n'))
  const names = [...failed, ...missing.map((m) => `${m} (no result)`)]
  console.error(`[${opts.app}] smoke failed: ${names.join(', ') || `electron exit ${r.status}`}`)
  process.exit(1)
}
console.log(`[${opts.app}] smoke passed: ${opts.checks.join(', ')}`)
