/**
 * 生病的肥鱼 · 面板运行时（Host 半）
 *
 * 两件事：
 *   1. GET  /dsh-sick-fatfish/panel           -> 快照（会话、等级、每个病、关心账本）
 *   2. POST /dsh-sick-fatfish/panel/action    -> on / off / roll / set_level / care / drop_care / relief / cure / worse
 *
 * 约束：状态只通过 api.loadRt / api.saveRt 改，不能直接写 sessions/*.json ——
 * 引擎在内存里缓存着同一份 rt，绕过它写盘会在下一次 saveRt 时被覆盖。
 * 面板是可选增强：webServer 拿不到就只是没有面板，插件照常工作。
 */
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { CHRONIC_IDS } from './engine.js'

const sendJson = (res, status, obj) => {
  try {
    res.statusCode = status
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify(obj))
  } catch {
    try {
      res.statusCode = 500
      res.end('{"ok":false,"message":"serialize failed"}')
    } catch {}
  }
}

const readBody = (req) =>
  new Promise((resolve) => {
    let buf = ''
    let size = 0
    let done = false
    const finish = (v) => {
      if (done) return
      done = true
      resolve(v)
    }
    try {
      req.on('data', (chunk) => {
        if (done) return
        size += chunk.length
        if (size > 128 * 1024) return finish('')
        buf += chunk
      })
      req.on('end', () => finish(buf))
      req.on('error', () => finish(''))
    } catch {
      finish('')
    }
  })

const num = (v, fb = 0) => (Number.isFinite(Number(v)) ? Number(v) : fb)

export function attachPanel(ctx, api) {
  const ID = api.ID
  const routePath = `/${ID}/panel`
  const sessionsDir = join(api.baseDir, 'sessions')

  const listSessions = () => {
    try {
      return readdirSync(sessionsDir)
        .filter((f) => f.endsWith('.json') && !f.endsWith('.tmp'))
        .map((f) => {
          let mtime = 0
          try {
            mtime = statSync(join(sessionsDir, f)).mtimeMs
          } catch {}
          return { sid: f.slice(0, -5), mtime: Math.round(mtime) }
        })
        .sort((a, b) => b.mtime - a.mtime)
    } catch {
      return []
    }
  }

  const pickSid = (want) => {
    const list = listSessions()
    const wanted = String(want || '').trim()
    if (wanted && list.some((x) => x.sid === wanted)) return wanted
    return list[0]?.sid || ''
  }

  const diseasePayload = () =>
    api.DISEASES.map((d) => ({
      id: d.id,
      prefix: d.prefix,
      label: d.label,
      eeriness: num(d.eeriness, 2),
      chronic: CHRONIC_IDS.has(d.id),
      reliefs: (d.reliefs || []).map((r) => ({ id: r.id, label: r.label })),
    }))

  const configPayload = () => ({
    enabled: api.cfg?.enabled !== false,
    defaultEnabled: api.cfg?.defaultEnabled === true,
    perTurnMin: num(api.cfg?.perTurnMin, 12),
    startAt: num(api.cfg?.startAt, 34),
    flareAt: num(api.cfg?.flareAt, 76),
    idleDecay: num(api.cfg?.idleDecay, 0.3),
    cooldownMin: num(api.cfg?.cooldownMin, 8),
    careDailyCap: num(api.cfg?.careDailyCap, 8),
    careChronicAt: num(api.cfg?.careChronicAt, 12),
    chronicFloor: num(api.cfg?.chronicFloor, 6),
  })

  const snapshot = (wantSid) => {
    const now = Date.now()
    const sessions = listSessions()
    const sid = pickSid(wantSid)
    const base = { ok: true, id: ID, label: api.LABEL, levels: api.LEVELS, diseases: diseasePayload(), config: configPayload(), sessions, now }
    if (!sid) return { ...base, session: null }
    const rt = api.loadRt(sid)
    const s = api.status(rt)
    return {
      ...base,
      session: {
        sid,
        enabled: rt.enabled === true,
        level: s.level,
        levelLabel: s.levelLabel,
        count: s.count,
        care: s.care,
        gone: s.gone,
        diseases: s.diseases,
      },
    }
  }

  const runAction = (body) => {
    const action = String(body?.action || '').trim()
    const now = Date.now()
    const sid = pickSid(body?.sid)
    if (!sid) return { status: 409, payload: { ok: false, code: 'NO_SESSION', message: '这个会话还没有身体状态，先在对话里开一次。' } }
    const rt = api.loadRt(sid)

    if (action === 'on') {
      rt.enabled = true
      if (!rt.state?.level) rt.state = api.reroll(rt.state, api.rollLevel()).state
      try {
        api.attach(rt)
      } catch {}
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'off') {
      rt.enabled = false
      try {
        rt.detach?.()
      } catch {}
      rt.detach = null
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'roll') {
      const lv = body?.level ? Math.round(num(body.level)) : api.rollLevel()
      rt.state = api.reroll(rt.state, lv, Math.random, { keep: body?.keep === true }).state
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'set_level') {
      const lv = Math.round(num(body?.level, 1))
      if (!(lv >= 1 && lv <= 5)) return { status: 400, payload: { ok: false, code: 'BAD_LEVEL', message: '等级要 1~5。' } }
      rt.state = api.reroll(rt.state, lv, Math.random, { keep: true }).state
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'care') {
      const r = api.addCare(rt.state, api.cfg, { kind: body?.kind, quote: body?.quote, disease: body?.disease }, now)
      if (!r.ok) return { status: 400, payload: { ok: false, code: r.code, message: r.message } }
      rt.state = r.state
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'drop_care') {
      const r = api.dropCare(rt.state, { at: body?.at, index: body?.index }, now)
      if (!r.ok) return { status: 400, payload: { ok: false, code: 'NOT_FOUND', message: r.message } }
      rt.state = r.state
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'relief') {
      const worst = api.worstOf(rt.state, api.cfg, now)
      const id = String(body?.disease || worst?.a?.id || '')
      if (!id) return { status: 400, payload: { ok: false, code: 'NO_DISEASE', message: '身上没有病。' } }
      const r = api.relieveOne(rt.state, id, String(body?.kind || ''), now)
      if (!r.ok) return { status: 400, payload: { ok: false, code: 'NO_SUCH_RELIEF', message: '没有这个病或这种处理方式。' } }
      rt.state = r.state
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'cure') {
      rt.state = api.cureAll(rt.state, now)
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    if (action === 'worse') {
      const m = Math.max(1, Math.min(240, Math.round(num(body?.minutes, api.cfg?.perTurnMin ?? 12))))
      rt.state = api.aggravate(rt.state, api.cfg, m, now).state
      api.saveRt(rt)
      return { status: 200, payload: snapshot(sid) }
    }
    return { status: 400, payload: { ok: false, code: 'BAD_ACTION', message: `不认识的动作：${action || '(空)'}` } }
  }

  const registerRoutes = (webServer, webCtx) => {
    const register = (route) => {
      try {
        webCtx.effect(() => webServer.register(route), `${ID}: ${route.path}`)
      } catch {}
    }
    register({
      kind: 'exact',
      path: routePath,
      handler: async (req, res) => {
        if (req?.method && req.method !== 'GET') return sendJson(res, 405, { ok: false, message: '只支持 GET' })
        try {
          const url = String(req?.url || '')
          const qs = url.includes('?') ? new URLSearchParams(url.slice(url.indexOf('?') + 1)) : null
          sendJson(res, 200, snapshot(qs?.get('sid') || ''))
        } catch (e) {
          sendJson(res, 500, { ok: false, message: String(e?.message || e) })
        }
      },
    })
    register({
      kind: 'exact',
      path: `${routePath}/action`,
      handler: async (req, res) => {
        if (req?.method && req.method !== 'POST') return sendJson(res, 405, { ok: false, message: '只支持 POST' })
        try {
          const raw = await readBody(req)
          let body = {}
          try {
            body = raw ? JSON.parse(raw) : {}
          } catch {
            return sendJson(res, 400, { ok: false, code: 'BAD_JSON', message: '请求体不是合法 JSON' })
          }
          const r = runAction(body)
          sendJson(res, r.status, r.payload)
        } catch (e) {
          sendJson(res, 500, { ok: false, message: String(e?.message || e) })
        }
      },
    })
  }

  try {
    if (typeof ctx?.inject === 'function') {
      ctx.inject(['webServer'], (webCtx) => {
        const server = webCtx?.webServer
        if (server && typeof server.register === 'function') registerRoutes(server, webCtx)
      })
    }
  } catch {
    /* 没有 webServer：面板不存在，插件照常工作 */
  }

  try {
    mkdirSync(sessionsDir, { recursive: true })
  } catch {}
}
