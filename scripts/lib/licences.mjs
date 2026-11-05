// The licence texts the upstream NOTICE, ATTRIBUTION.md and ASSETS.md point at, and whether a site has them.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** files that name licence texts by their path in the upstream repository (= path in the site) */
export const NOTICE_FILES = ['NOTICE', 'ATTRIBUTION.md', 'ASSETS.md']

// A relative path with at least one folder whose file name is OFL*, LICENSE*/LICENCE* or *_LICENSE*.
// Paths inside URLs (preceded by / : .) and templates such as OFL-<family>.txt do not match.
const REF = /(?<![\w\/:.<>-])(?:[\w.-]+\/)+(?:OFL|LICEN[CS]E|[\w-]+_LICEN[CS]E)[\w.-]*/g

/** the licence paths `text` names, once each, without a sentence's closing full stop */
export function licenceRefs(text) {
  const refs = new Set()
  for (const m of text.matchAll(REF)) refs.add(m[0].replace(/\.+$/, ''))
  return [...refs]
}

/** "<file>: <path>" for every licence path a notice file in `dir` names that `dir` lacks */
export function missingLicenceRefs(dir) {
  const missing = []
  for (const f of NOTICE_FILES) {
    if (!existsSync(join(dir, f))) continue
    for (const ref of licenceRefs(readFileSync(join(dir, f), 'utf8'))) {
      if (!existsSync(join(dir, ref))) missing.push(`${f}: ${ref}`)
    }
  }
  return missing
}
