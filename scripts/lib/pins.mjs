// The pinned upstream versions (pins.json) and the names the outputs take from them.
import { readFileSync } from 'node:fs'

const APPS = ['photo', 'illust']
const GLOBALS = ['photocraft', 'vectorcraft']
const HEX40 = /^[0-9a-f]{40}$/

/** pins.json, checked field by field; an Error names the first bad field */
export function readPins(path = 'pins.json') {
  const raw = JSON.parse(readFileSync(path, 'utf8'))
  for (const app of APPS) {
    const p = raw[app]
    if (!p) throw new Error(`pins: missing "${app}"`)
    if (typeof p.repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(p.repo))
      throw new Error(`pins.${app}.repo: expected owner/name, got ${p.repo}`)
    if (typeof p.tag !== 'string' || !/^v\d+\.\d+\.\d+$/.test(p.tag))
      throw new Error(`pins.${app}.tag: expected vX.Y.Z, got ${p.tag}`)
    if (!HEX40.test(p.commit ?? ''))
      throw new Error(`pins.${app}.commit: expected a 40-hex commit, got ${p.commit}`)
    if (typeof p.webApp !== 'string' || !p.webApp)
      throw new Error(`pins.${app}.webApp: expected the web app folder`)
    if (!GLOBALS.includes(p.global))
      throw new Error(`pins.${app}.global: expected one of ${GLOBALS.join(', ')}, got ${p.global}`)
    if (!Number.isInteger(p.hanpanRev) || p.hanpanRev < 1)
      throw new Error(`pins.${app}.hanpanRev: expected an integer >= 1, got ${p.hanpanRev}`)
  }
  const fonts = raw.craftFonts
  if (!fonts || typeof fonts.repo !== 'string' || !HEX40.test(fonts.commit ?? ''))
    throw new Error('pins.craftFonts: expected { repo, commit } with a 40-hex commit')
  return raw
}

const version = (pin) => pin.tag.replace(/^v/, '')

/** e.g. hanpan-photo-web-0.20.2-h1.zip */
export const artifactName = (app, pins) =>
  `hanpan-${app}-web-${version(pins[app])}-h${pins[app].hanpanRev}.zip`

/** e.g. photo-v0.20.2-h1 */
export const releaseTag = (app, pins) => `${app}-v${version(pins[app])}-h${pins[app].hanpanRev}`
