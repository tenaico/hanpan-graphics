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

  // Hanpan embedded mode (UX review v2, W1): Save, Save As and Print from the app's menus and keys
  // ask the host page (window events `hanpan-host-<request>`) and write nothing themselves: no
  // captured download, and the document stays modified until the host has written the file.
  checks['host-save'] = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    api.captureDownloads(true)
    const docState = async () => {
      const i = await api.inspect()
      if (global === 'photocraft') return i.session?.documents?.[i.session?.active]
      return i.documents?.[i.activeDocument]
    }
    if (!(await docState())) await newDocument(api, global)
    if (global === 'photocraft') await api.execute('edit.fillForeground', {})
    else await api.execute('shape.rectangle', { x: 20, y: 20, width: 120, height: 80 })
    const heard = []
    for (const r of ['save', 'saveAs', 'print']) window.addEventListener(`hanpan-host-${r}`, () => heard.push(r))
    const files = (await api.files()).length
    if (global === 'photocraft') {
      // a menu click: ui.menu.invoke runs the command as the menu does
      for (const command of ['file.save', 'file.saveAs', 'file.print']) await api.request('ui.menu.invoke', { command })
    } else {
      // the keys: Ctrl+S, Ctrl+Shift+S, Ctrl+P (the shortcuts run the menu commands)
      for (const [key, shift] of [['S', false], ['S', true], ['P', false]]) {
        await api.request('ui.key', { key, ctrl: true, cmd: true, shift })
        await sleep(400)
      }
    }
    await sleep(1500)
    const after = await docState()
    const wrote = (await api.files()).length - files
    if (heard.join() !== 'save,saveAs,print') return fail(`host asked for ${JSON.stringify(heard)}`)
    if (wrote !== 0) return fail(`the app wrote ${wrote} file(s) itself`)
    if (!after?.dirty) return fail(`the document reads saved: ${JSON.stringify(after)}`)
    return ok(`host asked for ${heard.join(', ')}; nothing written; still modified`)
  }

  // PhotoCraft (Hanpan, h4): app.exportImage {format: "psd"} is the layered document for the
  // host's recovery copy, the document left as it was
  checks['export-psd'] = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    if (!(await api.inspect()).session?.documents?.length) await newDocument(api, global)
    await api.execute('edit.fillForeground', {})
    const state = async () => JSON.stringify((await api.inspect()).session?.documents?.[0])
    const before = await state()
    const r = await api.request('app.exportImage', { format: 'psd' })
    const head = atob(String(r?.dataBase64 ?? '').slice(0, 8)).slice(0, 4)
    if (head !== '8BPS') return fail(`not a PSD: ${JSON.stringify(r).slice(0, 120)}`)
    if ((await state()) !== before) return fail(`state changed: ${before} → ${await state()}`)
    return ok(`PSD ${Math.round((r.dataBase64.length * 3) / 4)} bytes; document unchanged`)
  }

  // PhotoCraft: app.exportImage hands back the composite image without touching the document,
  // the status line, the notices or the captured downloads
  checks['export-image'] = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    api.captureDownloads(true)
    const look = async () => {
      const i = await api.inspect()
      const s = i.session ?? {}
      const d = s.documents?.[s.active]
      return { dirty: d?.dirty, status: i.status ?? i.ui?.status, notices: (i.notices ?? i.ui?.notices ?? []).length, files: (await api.files()).length }
    }
    if (!(await api.inspect()).session?.documents?.length) await newDocument(api, global)
    await api.execute('edit.fillForeground', {})
    const before = await look()
    const results = []
    for (const [params, want] of [
      [{ format: 'png' }, { mime: [0x89, 0x50, 0x4e, 0x47], w: 600, h: 300 }],
      [{ format: 'jpeg', quality: 80, maxSide: 200 }, { mime: [0xff, 0xd8, 0xff], w: 200, h: 100 }],
    ]) {
      let r
      try {
        r = await api.request('app.exportImage', params)
      } catch (e) {
        return fail(`${JSON.stringify(params)} rejected: ${e && e.message}`)
      }
      if (typeof r?.dataBase64 !== 'string') return fail(`${JSON.stringify(params)}: no dataBase64 in ${JSON.stringify(r).slice(0, 200)}`)
      const head = [...atob(r.dataBase64.slice(0, 8))].map((c) => c.charCodeAt(0))
      if (!want.mime.every((b, i) => head[i] === b)) return fail(`${JSON.stringify(params)}: bytes ${head}`)
      if (r.width !== want.w || r.height !== want.h) return fail(`${JSON.stringify(params)}: ${r.width}x${r.height}, want ${want.w}x${want.h}`)
      results.push(`${params.format} ${r.width}x${r.height} ${Math.round((r.dataBase64.length * 3) / 4)}B`)
    }
    try {
      await api.request('app.exportImage', { format: 'gif' })
      return fail('format gif was accepted')
    } catch {}
    await sleep(500)
    const after = await look()
    if (JSON.stringify(after) !== JSON.stringify(before)) return fail(`state changed: ${JSON.stringify(before)} → ${JSON.stringify(after)}`)
    return ok(`${results.join('; ')}; state unchanged ${JSON.stringify(after)}`)
  }

  // Hanpan embedded mode (?embedded=hanpan): the font menus' "이 PC의 글꼴" section lists the PC's
  // fonts (window.queryLocalFonts, allowed here as Hanpan's shell allows it) and loads a picked
  // family. Through the page API's `fonts.local`, the same path: list, load 맑은 고딕 (Malgun
  // Gothic, Windows), set Korean text in it without a fallback, and export it (PhotoCraft: the PNG
  // composite; VectorCraft: SVG with outlines, and SVG with the font embedded as @font-face).
  checks['local-fonts'] = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    if (typeof window.queryLocalFonts !== 'function') return fail('no window.queryLocalFonts in this page')
    const poll = async (params, done, ms) => {
      const t0 = performance.now()
      let r
      while (performance.now() - t0 < ms) {
        r = await api.request('fonts.local', params)
        if (done(r)) return r
        await sleep(300)
      }
      return r
    }
    const listed = await poll({}, (r) => r.listing !== 'pending', 30000)
    if (listed?.listing !== 'listed') return fail(`list: ${JSON.stringify(listed)}`)
    const family = 'Malgun Gothic'
    if (!listed.families.includes(family)) return fail(`${listed.families.length} PC families, no ${family}`)
    const t0 = performance.now()
    const loaded = await poll({ family }, (r) => r.status !== 'loading', 30000)
    if (loaded?.status !== 'loaded') return fail(`load: ${JSON.stringify(loaded)}`)
    const ms = Math.round(performance.now() - t0)
    const font = loaded.names.find((n) => n.toLowerCase() === family.toLowerCase()) ?? loaded.names[0]
    // PhotoCraft registers the files on its next frame
    const t1 = performance.now()
    while (performance.now() - t1 < 10000 && !(await fontFamilies(api, global)).includes(font)) await sleep(300)
    if (!(await fontFamilies(api, global)).includes(font)) return fail(`${font} not in the app's font list after loading`)
    const i = await api.inspect()
    const docs = global === 'photocraft' ? i.session?.documents?.length : i.documents?.length
    if (!docs) await newDocument(api, global)
    const params = { x: 40, y: 120, text: '맑은 고딕 한판 테스트', font, size: 36 }
    const made = global === 'photocraft' ? await api.execute('type.create', params) : await api.execute('text.create', params)
    if (/fallback|not available|missing/i.test(JSON.stringify(made))) return fail(`text fell back: ${JSON.stringify(made).slice(0, 300)}`)
    const bytesOf = (b64) => [...atob(b64.slice(0, 8))].map((c) => c.charCodeAt(0))
    let exported
    if (global === 'photocraft') {
      const r = await api.request('app.exportImage', { format: 'png' })
      const head = bytesOf(r.dataBase64)
      if (head[0] !== 0x89 || head[1] !== 0x50) return fail(`export: not a PNG ${head}`)
      exported = `PNG ${r.width}x${r.height}`
    } else {
      const svg = async (opts) => {
        const r = await api.request('app.export', { format: 'svg', ...opts })
        return new TextDecoder().decode(Uint8Array.from(atob(r.dataBase64), (c) => c.charCodeAt(0)))
      }
      const outlined = await svg({ outlineText: true })
      if (/<text[\s>]/.test(outlined) || !/<path[\s>]/.test(outlined)) return fail(`outlined SVG has <text> or no <path>: ${outlined.slice(0, 300)}`)
      const embedded = await svg({ outlineText: false, embedFonts: true })
      if (!/@font-face/.test(embedded) || !embedded.includes(font)) return fail(`SVG with embedFonts: no @font-face for ${font}: ${embedded.slice(0, 400)}`)
      exported = `SVG outlines ${outlined.length}B, @font-face ${embedded.length}B`
    }
    return ok(`${listed.families.length} PC families; ${font} (${loaded.names.length} names) loaded in ${ms}ms; Korean text set; ${exported}`)
  }

  // Hanpan theme (?embedded=hanpan): `hanpan.theme {mode}` switches the chrome to the host's dark
  // and back to light, `hanpan.status` reads each mode back, and the menu bar is the host's
  // colour (spec 5.1: #252525 dark, #ffffff light) in the app's own screenshot.
  const MENU_BAR = { dark: [0x25, 0x25, 0x25], light: [0xff, 0xff, 0xff] }
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  // the commonest colour of the window's top 24 rows (the menu bar)
  const menuBarColour = async (api, global) => {
    const r = global === 'photocraft' ? await api.screenshot({ focus: false }) : await api.screenshot({ data: true, focus: false })
    const b64 = r?.base64 ?? r?.pngBase64 ?? r?.dataBase64
    if (typeof b64 !== 'string') throw new Error(`no PNG in the screenshot reply: ${JSON.stringify(r).slice(0, 160)}`)
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, Math.min(24, bitmap.height))
    const g = canvas.getContext('2d')
    g.drawImage(bitmap, 0, 0)
    const px = g.getImageData(0, 0, canvas.width, canvas.height).data
    const counts = new Map()
    for (let i = 0; i < px.length; i += 4) {
      const k = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2]
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const [k] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    return [(k >> 16) & 255, (k >> 8) & 255, k & 255]
  }
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= 3)
  checks.theme = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    if (!/(^|[?&])embedded=hanpan(&|$)/.test(location.search)) return fail(`no embedded=hanpan in ${location.search}`)
    const seen = []
    for (const mode of ['dark', 'light']) {
      const set = await api.request('hanpan.theme', { mode })
      const status = await api.request('hanpan.status', {})
      await sleep(300)
      let bar
      try {
        bar = await menuBarColour(api, global)
      } catch (e) {
        return fail(`${mode}: screenshot: ${e && e.message}`)
      }
      seen.push({ mode, set: set?.mode, status: status?.mode, bar: hex(bar) })
      if (status?.mode !== mode) return fail(`after hanpan.theme ${mode}: ${JSON.stringify(seen)}`)
      if (!near(bar, MENU_BAR[mode])) return fail(`${mode}: menu bar ${hex(bar)}, want ${hex(MENU_BAR[mode])}; ${JSON.stringify(seen)}`)
    }
    if (seen[0].status === seen[1].status || seen[0].bar === seen[1].bar) return fail(`dark and light read the same: ${JSON.stringify(seen)}`)
    return ok(seen.map((s) => `${s.mode}: status ${s.status}, menu bar ${s.bar}`).join('; '))
  }

  // Hanpan UI font (?embedded=hanpan): the interface's Hangul is drawn with the PC's own face,
  // read at startup without a user gesture (the host allows local-fonts). Windows: Malgun Gothic
  // within 10 s of the app's first reply; elsewhere NanumGothic (the fallback) is accepted too.
  // The timeline, polled from the moment this script is in the page, says how long after the
  // app first answered the face arrived: until then the first frames draw Hangul in NanumGothic,
  // and labels change width when the face arrives (Task 4 measured 6.4 % wider with the PC face).
  const timeline = { injected: Math.round(performance.now()) }
  if (/(^|[?&])embedded=hanpan(&|$)/.test(location.search)) {
    ;(async () => {
      const api = await waitFor(() => window.photocraft ?? window.vectorcraft, 60000)
      if (!api) return
      timeline.api = Math.round(performance.now())
      while (performance.now() - timeline.api < 60000) {
        try {
          const s = await api.request('hanpan.status', {})
          const t = Math.round(performance.now())
          if (timeline.firstReply === undefined) Object.assign(timeline, { firstReply: t, firstFont: s?.uiFont })
          if (s?.uiFont && s.uiFont !== 'NanumGothic') {
            Object.assign(timeline, { faceAt: t, face: s.uiFont })
            return
          }
        } catch (e) {
          timeline.error = String(e && e.message)
          return
        }
        await sleep(50)
      }
    })()
  }
  checks.font = async ({ global }) => {
    const api = await waitFor(() => window[global], 60000)
    if (!api) return fail(`no window.${global}`)
    if (!/(^|[?&])embedded=hanpan(&|$)/.test(location.search)) return fail(`no embedded=hanpan in ${location.search}`)
    const windows = /Windows/.test(navigator.userAgent)
    await waitFor(() => timeline.firstReply !== undefined || timeline.error, 60000)
    if (timeline.error) return fail(`hanpan.status: ${timeline.error}`)
    if (timeline.firstReply === undefined) return fail('hanpan.status gave no reply in 60s')
    const deadline = timeline.firstReply + 10000
    while (performance.now() < deadline && timeline.faceAt === undefined) await sleep(100)
    const status = await api.request('hanpan.status', {})
    const t = (n) => (n === undefined ? '-' : `${n}ms`)
    const when =
      timeline.faceAt === undefined
        ? 'no PC face 10s after the first reply'
        : timeline.faceAt <= timeline.firstReply
          ? "face already there at the app's first reply (+0ms)"
          : `face arrived +${timeline.faceAt - timeline.firstReply}ms after the app's first reply (which drew ${timeline.firstFont})`
    const detail = `uiFont ${status?.uiFont}; ${when}; since page load: api ${t(timeline.api)}, first reply ${t(timeline.firstReply)}, face ${t(timeline.faceAt)}`
    if (status?.uiFont === 'Malgun Gothic') return ok(detail)
    if (!windows && status?.uiFont === 'NanumGothic') return ok(`${detail} (not Windows: fallback accepted)`)
    return fail(detail)
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
