import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { patchList, applyPatches, patchName } from '../scripts/lib/patches.mjs'

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

/** a repo with one committed file, two sequential patches for it, and an empty patches folder */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'patches-'))
  const repo = join(root, 'repo')
  mkdirSync(repo)
  git(repo, 'init', '-q')
  git(repo, 'config', 'core.autocrlf', 'false')
  writeFileSync(join(repo, 'a.txt'), 'one\ntwo\nthree\n')
  git(repo, 'add', '.')
  git(repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base')
  writeFileSync(join(repo, 'a.txt'), 'ONE\ntwo\nthree\n')
  const first = git(repo, 'diff')
  // the second patch is cut against the tree the first one leaves
  git(repo, 'add', 'a.txt')
  writeFileSync(join(repo, 'a.txt'), 'ONE\ntwo\nTHREE\n')
  const second = git(repo, 'diff')
  git(repo, 'reset', '-q', '--hard')
  const dir = join(root, 'patches', 'photo')
  mkdirSync(dir, { recursive: true })
  return { root, repo, dir, first, second }
}

test('lists patches in number order', () => {
  const f = fixture()
  writeFileSync(join(f.dir, '0002-b.patch'), f.first)
  writeFileSync(join(f.dir, '0001-a.patch'), f.first)
  writeFileSync(join(f.dir, '0010-c.patch'), f.first)
  assert.deepEqual(
    patchList('photo', f.root).map((p) => p.split(/[\\/]/).pop()),
    ['0001-a.patch', '0002-b.patch', '0010-c.patch'],
  )
})

test('refuses a file that does not follow the naming rule', () => {
  const f = fixture()
  writeFileSync(join(f.dir, 'readme.txt'), 'x')
  assert.throws(() => patchList('photo', f.root), /readme\.txt/)
})

test('applies patches in number order', () => {
  const f = fixture()
  writeFileSync(join(f.dir, '0002-upper-three.patch'), f.second)
  writeFileSync(join(f.dir, '0001-upper-one.patch'), f.first)
  applyPatches(f.repo, patchList('photo', f.root))
  assert.equal(readFileSync(join(f.repo, 'a.txt'), 'utf8'), 'ONE\ntwo\nTHREE\n')
})

test('applyPatches leaves the tree untouched when one patch does not apply', () => {
  const f = fixture()
  writeFileSync(join(f.dir, '0001-ok.patch'), f.first)
  writeFileSync(join(f.dir, '0002-conflict.patch'), f.first.replace(/one/g, 'zzz'))
  assert.throws(() => applyPatches(f.repo, patchList('photo', f.root)), /0002-conflict\.patch/)
  assert.equal(git(f.repo, 'status', '--porcelain'), '')
})

test('refuses a checkout with local changes', () => {
  const f = fixture()
  writeFileSync(join(f.dir, '0001-ok.patch'), f.first)
  writeFileSync(join(f.repo, 'a.txt'), 'local edit\n')
  assert.throws(() => applyPatches(f.repo, patchList('photo', f.root)), /clean checkout/)
  assert.equal(readFileSync(join(f.repo, 'a.txt'), 'utf8'), 'local edit\n')
})

test('patchName takes the file name with either separator', () => {
  assert.equal(patchName('C:\\x\\patches\\photo\\0001-web-control-api.patch'), '0001-web-control-api.patch')
  assert.equal(patchName('/x/patches/photo/0002-brand-cleanup.patch'), '0002-brand-cleanup.patch')
})
