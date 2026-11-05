import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { stageSite } from '../scripts/lib/stage.mjs'
import { licenceRefs, missingLicenceRefs } from '../scripts/lib/licences.mjs'

const put = (path, text = 'x') => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

const NOTICE = `Thing
Inter font (assets/fonts/Inter-*.ttf) — OFL. See assets/fonts/OFL-Inter.txt.
Weights (crates/algo/data/model.bin) — BSD-3-Clause. See crates/algo/data/LICENSE-model.txt.
Brand terms are in docs/brand/LICENSE-brand.txt.
Foxit: see licenses/pdf-backend/x/assets/LICENSE_FOXIT.
Fonts ship as OFL-<family>.txt; upstream text at https://github.com/a/b/blob/main/LICENSE.txt
`
const ATTRIBUTION = '| `crates/ui/src/i18n/ko.tsv` | MIT, [`LICENSE-translations.txt`](crates/ui/src/i18n/LICENSE-translations.txt) |\n'

/** a fake upstream checkout and craft-fonts under a temp work dir */
function fakeWork() {
  const work = mkdtempSync(join(tmpdir(), 'hg-stage-'))
  const up = join(work, 'photo')
  put(join(up, 'dist', 'web', 'index.html'), '<html></html>')
  for (const f of ['LICENSE-MIT', 'LICENSE-APACHE']) put(join(up, f))
  put(join(up, 'NOTICE'), NOTICE)
  put(join(up, 'ATTRIBUTION.md'), ATTRIBUTION)
  put(join(up, 'assets', 'fonts', 'OFL-Inter.txt'))
  put(join(up, 'assets', 'fonts', 'Inter-Regular.ttf'))
  put(join(up, 'assets', 'icons', 'LICENSE-unreferenced.txt'))
  put(join(up, 'crates', 'algo', 'data', 'LICENSE-model.txt'))
  put(join(up, 'crates', 'ui', 'src', 'i18n', 'LICENSE-translations.txt'))
  put(join(up, 'docs', 'brand', 'LICENSE-brand.txt'))
  put(join(up, 'licenses', 'pdf-backend', 'x', 'assets', 'LICENSE_FOXIT'))
  put(join(work, 'craft-fonts', 'fonts', 'nanum-gothic', 'OFL.txt'))
  return { work, out: join(work, 'out') }
}

test('licenceRefs finds the repo-relative licence paths, not URLs or templates', () => {
  assert.deepEqual(licenceRefs(NOTICE + ATTRIBUTION).sort(), [
    'assets/fonts/OFL-Inter.txt',
    'crates/algo/data/LICENSE-model.txt',
    'crates/ui/src/i18n/LICENSE-translations.txt',
    'docs/brand/LICENSE-brand.txt',
    'licenses/pdf-backend/x/assets/LICENSE_FOXIT',
  ])
})

test('every licence path the NOTICE and ATTRIBUTION name is in the staged site', () => {
  const { work, out } = fakeWork()
  const site = stageSite('photo', work, out)
  for (const ref of licenceRefs(NOTICE + ATTRIBUTION)) assert.ok(existsSync(join(site, ref)), `missing ${ref}`)
  assert.ok(existsSync(join(site, 'assets', 'icons', 'LICENSE-unreferenced.txt')), 'licence texts under assets/** ship too')
  assert.ok(!existsSync(join(site, 'assets', 'fonts', 'Inter-Regular.ttf')), 'only licence texts are copied')
  assert.deepEqual(missingLicenceRefs(site), [])
})

test('missingLicenceRefs names a referenced licence the site lacks', () => {
  const site = mkdtempSync(join(tmpdir(), 'hg-site-'))
  put(join(site, 'NOTICE'), 'See assets/fonts/OFL-Inter.txt and assets/dict/LICENSE-SCOWL.txt.')
  put(join(site, 'assets', 'fonts', 'OFL-Inter.txt'))
  assert.deepEqual(missingLicenceRefs(site), ['NOTICE: assets/dict/LICENSE-SCOWL.txt'])
})

test('stageSite fails when NOTICE names a licence the upstream does not have', () => {
  const { work, out } = fakeWork()
  put(join(work, 'photo', 'NOTICE'), NOTICE + 'See assets/dict/LICENSE-gone.txt.\n')
  assert.throws(() => stageSite('photo', work, out), /assets\/dict\/LICENSE-gone\.txt/)
})
