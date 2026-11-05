// Page side of the smoke checks; runs inside the hosted web app. Each check resolves to
// { ok, detail }. Tasks 3, 4 and 6 add checks here.
;(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const ok = (detail) => ({ ok: true, detail })
  const fail = (detail) => ({ ok: false, detail })
  const METHODS = ['request', 'execute', 'commands', 'inspect', 'screenshot', 'openFile', 'captureDownloads', 'files', 'readFile']
  const MIN_COMMANDS = { photo: 400, illust: 1000 }

  async function waitFor(fn, ms) {
    const t0 = performance.now()
    while (performance.now() - t0 < ms) {
      const v = fn()
      if (v) return v
      await sleep(100)
    }
    return null
  }

  const checks = {
    async boot() {
      const canvas = await waitFor(() => document.querySelector('canvas'), 60000)
      if (!canvas) return fail('no canvas after 60s')
      await sleep(3000)
      return ok(`canvas ${canvas.width}x${canvas.height}`)
    },
    async api({ global, app }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global} after 60s`)
      const missing = METHODS.filter((m) => typeof api[m] !== 'function')
      if (missing.length) return fail(`missing ${missing.join(', ')}`)
      const cmds = await api.commands()
      if (!Array.isArray(cmds) || cmds.length < MIN_COMMANDS[app]) return fail(`commands: ${cmds && cmds.length}`)
      return ok(`${cmds.length} commands`)
    },
    // Hanpan calls the API the moment it appears: that call waits for the app, it does not throw
    async 'api-immediate'({ global }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global} after 60s`)
      try {
        const cmds = await Promise.race([api.commands(), sleep(60000).then(() => 'timeout')])
        if (cmds === 'timeout') return fail('commands() did not settle in 60s')
        return Array.isArray(cmds) ? ok(`${cmds.length} commands on first call`) : fail(`not an array: ${typeof cmds}`)
      } catch (e) {
        return fail(`first call threw: ${e && e.message}`)
      }
    },
    // PhotoCraft when the app cannot start (run with --gpu none, a page without WebGPU or WebGL):
    // a call made at once and a call made after the failure both reject with the reason, they do
    // not wait forever, and openFile returns false
    async 'api-no-start'({ global }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global} after 60s`)
      const settle = (p) =>
        Promise.race([
          p.then(() => 'resolved', (e) => `rejected: ${e && e.message}`),
          sleep(30000).then(() => 'still pending after 30s'),
        ])
      const early = await settle(api.commands())
      const failed = await waitFor(() => /failed to start/i.test(document.body.innerText), 10000)
      if (!failed) return fail(`the app started (or showed no failure); early call: ${early}`)
      const late = await Promise.race([
        api.inspect().then(() => 'resolved', (e) => `rejected: ${e && e.message}`),
        sleep(2000).then(() => 'still pending after 2s'),
      ])
      const opened = api.openFile('x.png', new Uint8Array([1, 2, 3]))
      const good = (r) => /^rejected: .*failed to start/i.test(r)
      const detail = `early: ${early}; late: ${late}; openFile: ${opened}`
      return good(early) && good(late) && opened === false ? ok(detail) : fail(detail)
    },
    // a save the page captured can be read back: new document, PNG export, readFile
    async capture({ global }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global}`)
      const ids = (await api.commands()).map((c) => c.id)
      // a file export, not the clipboard one
      const exportId =
        ids.find((id) => /^file\.export/i.test(id) && /png/i.test(id)) ??
        ids.find((id) => !/clipboard/i.test(id) && /export/i.test(id) && /png/i.test(id))
      if (!exportId) return fail('no PNG export command')
      api.captureDownloads(true)
      const newResult = global === 'photocraft'
        ? await api.execute('file.new', { width: 320, height: 200 })
        : await api.execute('file.newWithoutDialog', {})
      // PhotoCraft's engine exports write to disk (desktop only); File › Save's path is app.save
      const exported =
        global === 'photocraft'
          ? await api.request('app.save', { path: 'smoke.png' })
          : await api.execute(exportId, { path: 'smoke.png' })
      await sleep(1500)
      const files = await api.files()
      const hit = files.find((f) => /smoke\.png$/.test(f.path))
      if (!hit) return fail(`no captured file; files=${JSON.stringify(files)} export=${JSON.stringify(exported)} new=${JSON.stringify(newResult)}`)
      const bytes = await api.readFile(hit.path)
      const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      return png ? ok(`${exportId} → ${hit.path} ${bytes.length} bytes`) : fail('captured file is not a PNG')
    },
  }

  // the app's font family list, and Korean text created with a font
  const fontFamilies = async (api, global) => {
    const r = global === 'photocraft' ? await api.execute('type.fonts', {}) : await api.execute('text.fontList', {})
    return JSON.stringify(r)
  }
  const koreanText = (api, global, y) =>
    global === 'photocraft'
      ? api.execute('type.create', { x: 40, y, text: '안녕하세요 한판', font: 'NanumGothic', size: 24 })
      : api.execute('text.create', { x: 40, y, text: '안녕하세요 한판', font: 'NanumGothic', size: 24 })
  const newDocument = (api, global) =>
    global === 'photocraft' ? api.execute('file.new', { width: 600, height: 300 }) : api.execute('file.newWithoutDialog', {})

  checks.fonts = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    const t0 = performance.now()
    while (performance.now() - t0 < 30000) {
      if ((await fontFamilies(api, global)).includes('NanumGothic')) return ok(`NanumGothic after ${Math.round(performance.now() - t0)}ms`)
      await sleep(500)
    }
    return fail('NanumGothic not in the font list after 30s')
  }

  // Korean text made the moment the API appears: the font arrives shortly and then draws it
  checks['fonts-early-text'] = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    await newDocument(api, global)
    const first = await koreanText(api, global, 80)
    const t0 = performance.now()
    while (performance.now() - t0 < 20000 && !(await fontFamilies(api, global)).includes('NanumGothic')) await sleep(500)
    const second = await koreanText(api, global, 160)
    const warned = /fallback|not available|missing/i.test(JSON.stringify(second))
    return warned
      ? fail(`still a fallback after the font arrived: ${JSON.stringify(second)}`)
      : ok(`first ${JSON.stringify(first).slice(0, 80)}; second without a fallback warning`)
  }


  // Hanpan embedded mode (?embedded=hanpan): the host owns files, so Open, Open Recent, Close and
  // Close All are off, and New only makes the first document. Ids are the ones commands() lists.
  const EMBED_IDS = {
    // PhotoCraft's commands() lists engine commands: File › Open and Open Recent are UI-only there
    photocraft: { new: ['file.new'], off: ['file.openAs', 'file.close', 'file.closeAll'] },
    vectorcraft: {
      new: ['file.new', 'file.newDialog', 'file.newWithoutDialog'],
      off: ['file.open', 'file.openRecent1', 'file.close', 'file.closeAll'],
    },
  }
  // the menus show no Open, Open Recent, Close or Close All they would run (`ui.menu.list`)
  const menuOpenClose = async (api) => {
    const items = await api.request('ui.menu.list', {})
    const on = items.filter((i) => i.enabled && /^file\.(open|openAs|openRecent.*|close|closeAll)$/.test(i.id ?? i.command ?? ''))
    return on.map((i) => i.id ?? i.command)
  }
  const enabledOf = (cmds, ids) => Object.fromEntries(ids.map((id) => [id, cmds.find((c) => c.id === id)?.enabled]))
  checks.embedded = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    if (!/(^|[?&])embedded=hanpan(&|$)/.test(location.search)) return fail(`no embedded=hanpan in ${location.search}`)
    const ids = EMBED_IDS[global]
    const docs = async () => {
      const i = await api.inspect()
      return (i.documents ?? i.session?.documents ?? []).length
    }
    // a document left by an earlier check would hide the start state
    if ((await docs()) !== 0) return fail(`a document is already open (${await docs()})`)
    const before = enabledOf(await api.commands(), [...ids.new, ...ids.off])
    const bad = (m) => fail(`${m}; before=${JSON.stringify(before)}`)
    const missing = Object.entries(before).filter(([, e]) => e === undefined).map(([id]) => id)
    if (missing.length) return bad(`not in commands(): ${missing.join(', ')}`)
    if (!ids.new.every((id) => before[id] === true)) return bad('New is not enabled at the start')
    if (!ids.off.every((id) => before[id] === false)) return bad('Open/Close is enabled')
    const menuBefore = await menuOpenClose(api)
    if (menuBefore.length) return fail(`menu items on at the start: ${menuBefore.join(', ')}`)
    await newDocument(api, global)
    if ((await docs()) !== 1) return bad(`documents after New: ${await docs()}`)
    const after = enabledOf(await api.commands(), [...ids.new, ...ids.off])
    if (!Object.values(after).every((e) => e === false)) return fail(`with a document: ${JSON.stringify(after)}`)
    const menuAfter = await menuOpenClose(api)
    if (menuAfter.length) return fail(`menu items on with a document: ${menuAfter.join(', ')}`)
    return ok(`new ${ids.new.join('/')} on→off; ${ids.off.join('/')} off; menus too`)
  }
  checks['embedded-with-lang'] = async (ctx) => {
    if (!/(^|[?&])lang=/.test(location.search)) return fail(`no lang= in ${location.search}`)
    return checks.embedded(ctx)
  }

  // a save through the page API is captured and leaves the document clean (not modified)
  checks['save-clean'] = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    api.captureDownloads(true)
    const docState = async () => {
      const i = await api.inspect()
      if (global === 'photocraft') {
        const s = i.session ?? {}
        return s.documents?.[s.active]
      }
      return i.documents?.[i.activeDocument]
    }
    // embedded mode keeps the document an earlier check made: New is off then
    if (!(await docState())) await newDocument(api, global)
    const edit =
      global === 'photocraft'
        ? await api.execute('edit.fillForeground', {})
        : await api.execute('shape.rectangle', { x: 20, y: 20, width: 120, height: 80 })
    const before = await docState()
    if (!before?.dirty) return fail(`not modified after the edit: ${JSON.stringify(before)} edit=${JSON.stringify(edit).slice(0, 200)}`)
    const name = global === 'photocraft' ? 'save-clean.psd' : 'save-clean.svg'
    const saved = await api.request('app.save', global === 'photocraft' ? { path: name } : { path: name, wait: true })
    await sleep(1500)
    const hit = (await api.files()).find((f) => f.path.endsWith(name))
    if (!hit) return fail(`no captured ${name}; save=${JSON.stringify(saved)} files=${JSON.stringify(await api.files())}`)
    const after = await docState()
    if (after?.dirty !== false) return fail(`still modified after the save: ${JSON.stringify(after)} save=${JSON.stringify(saved)}`)
    return ok(`${hit.path} ${hit.size} bytes; dirty ${before.dirty}→${after.dirty}`)
  }

  window.__smoke = {
    async run(name, ctx) {
      const check = checks[name]
      if (!check) return fail(`unknown check ${name}`)
      return check(ctx)
    },
    checks,
  }
})()
