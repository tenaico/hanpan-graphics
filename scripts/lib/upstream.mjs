// Fetch an upstream repository at its pinned commit.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/**
 * `dir` holds `repo` at `commit` afterwards, with no local changes.
 * A checkout already at that commit is reset in place rather than fetched
 * again: unchanged files keep their modification times, so Cargo rebuilds
 * only what a patch touched (the build keeps CARGO_TARGET_DIR outside).
 */
export function checkoutPinned({ repo, tag, commit }, dir) {
  if (existsSync(join(dir, '.git'))) {
    let head = ''
    try {
      head = git(dir, 'rev-parse', 'HEAD')
    } catch {}
    if (head === commit) {
      git(dir, 'reset', '-q', '--hard', commit)
      git(dir, 'clean', '-q', '-fdx')
      return
    }
    rmSync(dir, { recursive: true, force: true })
  }
  mkdirSync(dir, { recursive: true })
  git(dir, 'init', '-q')
  git(dir, 'config', 'core.autocrlf', 'false')
  git(dir, 'remote', 'add', 'origin', `https://github.com/${repo}.git`)
  git(dir, 'fetch', '-q', '--depth', '1', 'origin', tag ? `refs/tags/${tag}` : commit)
  git(dir, 'checkout', '-q', 'FETCH_HEAD')
  const head = git(dir, 'rev-parse', 'HEAD')
  if (head !== commit) throw new Error(`${repo} ${tag ?? ''} is ${head}, pinned ${commit}`)
}
