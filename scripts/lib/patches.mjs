// Our patches, applied to an upstream checkout all together or not at all.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const NAME = /^\d{4}-[a-z0-9-]+\.patch$/

/** patches/<app>/NNNN-name.patch, in number order; any other file (but .gitkeep) is an error */
export function patchList(app, root = REPO_ROOT) {
  const dir = join(root, 'patches', app)
  if (!existsSync(dir)) return []
  const names = readdirSync(dir).filter((n) => n !== '.gitkeep')
  const bad = names.filter((n) => !NAME.test(n))
  if (bad.length) throw new Error(`patches/${app}: not NNNN-name.patch: ${bad.join(', ')}`)
  return names
    .sort((a, b) => Number(a.slice(0, 4)) - Number(b.slice(0, 4)) || a.localeCompare(b))
    .map((n) => join(dir, n))
}

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

/**
 * Apply `patches` one after another to a clean checkout. If one does not
 * apply on top of the ones before it, the checkout is reset to where it
 * started and the error names that patch: a build never sees half of them.
 */
export function applyPatches(dir, patches) {
  if (git(dir, 'status', '--porcelain').trim())
    throw new Error(`applyPatches needs a clean checkout: ${dir} has changes`)
  for (const patch of patches) {
    const r = spawnSync('git', ['apply', '--whitespace=nowarn', patch], { cwd: dir, encoding: 'utf8' })
    if (r.status !== 0) {
      git(dir, 'reset', '-q', '--hard')
      git(dir, 'clean', '-q', '-fd')
      throw new Error(`patch does not apply: ${basename(patch)}\n${r.stderr}`)
    }
  }
}
