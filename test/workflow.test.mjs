import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const YAML = readFileSync('.github/workflows/build.yml', 'utf8').replace(/\r\n/g, '\n')

/** top-level key -> its indented block; jobs -> { name: block } (two-space indent, as the file is written) */
function blocks(text, indent) {
  const out = {}
  let key = null
  for (const line of text.split('\n')) {
    const m = line.match(new RegExp(`^${' '.repeat(indent)}([\\w-]+):(.*)$`))
    if (m) {
      key = m[1]
      out[key] = m[2].trim() ? `${m[2].trim()}\n` : ''
    } else if (key && (line.startsWith(' '.repeat(indent + 1)) || !line.trim())) out[key] += `${line}\n`
    else if (line.trim()) key = null
  }
  return out
}
const top = blocks(YAML, 0)
const jobs = blocks(top.jobs ?? '', 2)

test('no workflow-wide write token', () => {
  assert.ok(!/contents:\s*write/.test(top.permissions ?? ''), 'top-level permissions must not grant contents: write')
})

test('build job reads only and keeps no credentials in the checkout', () => {
  const b = jobs.build
  assert.ok(b, 'build job')
  assert.match(b, /permissions:\s*\n\s+contents:\s*read\b/)
  assert.doesNotMatch(b, /contents:\s*write/)
  assert.match(b, /uses: actions\/checkout@v4[^\n]*\n(?:\s+if:[^\n]*\n)?\s+with:\s*\n\s+persist-credentials:\s*false/)
  assert.match(b, /actions\/upload-artifact@v4/)
  assert.doesNotMatch(b, /gh release/)
})

test('rust-cache key follows pins and patches', () => {
  assert.match(jobs.build, /key: \$\{\{ matrix\.app \}\}-\$\{\{ hashFiles\('pins\.json', 'patches\/\*\*'\) \}\}/)
})

test('release job: after build, only when asked, the only writer, a draft at the built commit', () => {
  const r = jobs.release
  assert.ok(r, 'release job')
  assert.match(r, /needs:\s*build\b/)
  assert.match(r, /if:\s*\$\{\{\s*inputs\.release\s*\}\}|if:\s*inputs\.release/)
  assert.match(r, /permissions:\s*\n\s+contents:\s*write\b/)
  assert.match(r, /actions\/download-artifact@v4/)
  const cmd = r.match(/gh release create[^\n]*/)?.[0] ?? ''
  assert.match(cmd, /--draft/)
  assert.match(cmd, /--target "\$GITHUB_SHA"/)
  assert.match(cmd, /\.sha256/)
  assert.match(cmd, /--notes-file CHANGES-/)
})
