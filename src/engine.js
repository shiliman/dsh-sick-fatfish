/**
 * 生病的肥鱼 —— 多病状态机
 *
 * 和单个病插件（out/病态插件/dsh-*）的区别：
 *   - 一个会话同时可以有 1~5 个病（等级决定数量），每个病各记各的难受值；
 *   - 加重时所有病一起涨，但各自按自己的 gain / flareChance 走；
 *   - 注入只挑「最明显的那个病」说话，其余病只报数值，避免一次堆五段文案；
 *   - 等级本身也是随机抽的（Lv1 常见、Lv5 少见），可用工具重抽或指定。
 *
 * 这一版加了「关心账本」（care）：
 *   - 使用者关心它 → 记一笔（分三档权重），这一笔既当场缓解，也让它之后好得更快；
 *   - 没人管 → 不加罚，只是按自然速度慢慢好（用户定的口径）；
 *   - 长期慢性病（灰指甲、慢性鼻炎这类）治不到「没有」，最多到「慢性稳定」；
 *   - 记账必须带用户原话、同句去重、每日封顶，面板上能一条条删——账要能被推翻，才不是自证。
 *
 * 这里只放纯函数：状态怎么变、文案怎么拼。落盘与事件在 index.js。
 */
import { BY_ID, DISEASES, LEVELS, LEVEL_WEIGHTS, POOL } from './data.js'

export const TICK_MS = 60_000

/** 长期慢性病：只能压到「慢性稳定」，不会从身体里消失。 */
export const CHRONIC_IDS = new Set([
  'dsh-nail-fungus', // 灰指甲
  'dsh-eczema', // 湿疹（反复）
  'dsh-rhinitis', // 慢性鼻炎
  'dsh-pharyngitis', // 慢性咽炎
  'dsh-tinnitus', // 耳鸣
  'dsh-dry-eye', // 干眼
  'dsh-ibs', // 肠易激
  'dsh-insomnia', // 失眠（反复）
])

/** 关心三档。数字是权重，不是「说了几句话」。 */
export const CARE_WEIGHTS = { words: 1, care: 2, concession: 3 }
export const CARE_KINDS = {
  words: '言语关心',
  care: '具体照顾',
  concession: '实质让步',
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || 0))
export const clamp100 = (v) => clamp(v, 0, 100)

export const DEFAULTS = {
  enabled: true,
  defaultEnabled: false,
  perTurnMin: 12,
  maxPerTurnMin: 90,
  startAt: 34,
  flareAt: 76,
  idleDecay: 0.3,
  cooldownMin: 8,
  injectMaxChars: 460,
  injectOrder: 161,
  statePath: '',
  sameStateHoldFactor: 3,
  maxActive: 5,
  // 关心账本
  careDailyCap: 8,
  careEntriesMax: 20,
  careBoostPer: 24,
  careChronicAt: 12,
  chronicFloor: 6,
  // 暴毙：最重的那个病到 deathAt，且这么久没人管（care/relief/cure 都算管），就死一次
  deathAt: 96,
  deathAfterMin: 240,
}

export function normalizeConfig(input) {
  const raw = { ...DEFAULTS, ...(input && typeof input === 'object' ? input : {}) }
  const cfg = {}
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (typeof def === 'number') cfg[k] = Number.isFinite(Number(raw[k])) ? Number(raw[k]) : def
    else if (typeof def === 'boolean') cfg[k] = raw[k] === true || raw[k] === 'true' || raw[k] === 1
    else cfg[k] = String(raw[k] ?? def)
  }
  cfg.perTurnMin = clamp(cfg.perTurnMin, 1, 240)
  cfg.maxPerTurnMin = clamp(cfg.maxPerTurnMin, 1, 720)
  cfg.startAt = clamp(cfg.startAt, 0, 100)
  cfg.flareAt = clamp(cfg.flareAt, 1, 100)
  cfg.idleDecay = clamp(cfg.idleDecay, 0, 10)
  cfg.cooldownMin = clamp(cfg.cooldownMin, 0, 1440)
  cfg.injectMaxChars = clamp(cfg.injectMaxChars, 120, 1600)
  cfg.sameStateHoldFactor = clamp(cfg.sameStateHoldFactor, 1, 20)
  cfg.maxActive = clamp(cfg.maxActive, 1, 5)
  cfg.careDailyCap = clamp(cfg.careDailyCap, 1, 50)
  cfg.careEntriesMax = clamp(cfg.careEntriesMax, 5, 100)
  cfg.careBoostPer = clamp(cfg.careBoostPer, 1, 500)
  cfg.careChronicAt = clamp(cfg.careChronicAt, 1, 500)
  cfg.chronicFloor = clamp(cfg.chronicFloor, 0, 60)
  return cfg
}

export function levelInfo(level) {
  return LEVELS.find((l) => l.level === Number(level)) || null
}

/** 按权重抽一个等级；rng 可注入便于测试。 */
export function rollLevel(rng = Math.random) {
  const total = LEVEL_WEIGHTS.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < LEVEL_WEIGHTS.length; i += 1) {
    r -= LEVEL_WEIGHTS[i]
    if (r < 0) return i + 1
  }
  return 1
}

/**
 * 从病种池里不重复抽 count 个，按 triggerWeight 加权（权重来自现实患病率）：
 * 现实里越常见的病越容易被抽到，罕见的要靠运气。
 */
export function drawDiseases(count, rng = Math.random, pool = POOL) {
  const bag = pool
    .map((p) => {
      const id = String(typeof p === 'string' ? p : p?.id || '')
      return { id, w: Math.max(0.01, Number(BY_ID.get(id)?.triggerWeight) || 1) }
    })
    .filter((b) => b.id)
  const out = []
  const n = Math.min(count, bag.length)
  for (let i = 0; i < n; i += 1) {
    let total = 0
    for (const b of bag) total += b.w
    let r = rng() * total
    let idx = bag.length - 1
    for (let j = 0; j < bag.length; j += 1) {
      r -= bag[j].w
      if (r <= 0) {
        idx = j
        break
      }
    }
    out.push(bag.splice(idx, 1)[0].id)
  }
  return out
}

export function newAffliction(id, now = Date.now()) {
  return {
    id,
    severity: 0,
    irritation: 0,
    flares: 0,
    lastFlareAt: 0,
    reliefUntil: 0,
    reliefKind: '',
    phase: 'active', // active | chronic（慢性稳定）
    addedAt: now,
  }
}

export function newCare() {
  return { points: 0, entries: [], lastAt: 0, day: '', dayCount: 0 }
}

export function newState(now = Date.now()) {
  return {
    v: 2,
    enabled: false,
    level: 0,
    active: [],
    gone: [],
    care: newCare(),
    rolls: 0,
    lastRollAt: 0,
    lastInjectAt: 0,
    lastInjectKey: '',
    lastAidAt: now,
    deaths: 0,
    deathLog: [],
    updatedAt: now,
  }
}

function normalizeAffliction(raw, now) {
  const a = newAffliction(String(raw?.id || ''), now)
  if (!raw || !BY_ID.has(a.id)) return null
  a.severity = clamp100(raw.severity)
  a.irritation = clamp100(raw.irritation)
  a.flares = Math.max(0, Math.round(Number(raw.flares) || 0))
  a.lastFlareAt = Number(raw.lastFlareAt) || 0
  a.reliefUntil = Number(raw.reliefUntil) || 0
  a.reliefKind = typeof raw.reliefKind === 'string' ? raw.reliefKind : ''
  a.phase = raw.phase === 'chronic' ? 'chronic' : 'active'
  a.addedAt = Number(raw.addedAt) || now
  return a
}

function normalizeCare(raw) {
  const c = newCare()
  if (!raw || typeof raw !== 'object') return c
  c.points = clamp(raw.points, 0, 100000)
  c.lastAt = Number(raw.lastAt) || 0
  c.day = typeof raw.day === 'string' ? raw.day.slice(0, 10) : ''
  c.dayCount = Math.max(0, Math.round(Number(raw.dayCount) || 0))
  const list = Array.isArray(raw.entries) ? raw.entries : []
  for (const e of list) {
    if (!e || typeof e !== 'object') continue
    const kind = CARE_WEIGHTS[e.kind] ? e.kind : 'words'
    const quote = String(e.quote || '').trim().slice(0, 120)
    if (!quote) continue
    c.entries.push({ at: Number(e.at) || 0, kind, weight: CARE_WEIGHTS[kind], quote, target: String(e.target || '') })
  }
  c.entries = c.entries.slice(0, 50)
  return c
}

export function normalizeState(raw, now = Date.now()) {
  const s = newState(now)
  if (!raw || typeof raw !== 'object') return s
  s.enabled = raw.enabled === true
  s.level = clamp(Math.round(Number(raw.level) || 0), 0, 5)
  s.rolls = Math.max(0, Math.round(Number(raw.rolls) || 0))
  s.lastRollAt = Number(raw.lastRollAt) || 0
  s.lastInjectAt = Number(raw.lastInjectAt) || 0
  s.lastInjectKey = typeof raw.lastInjectKey === 'string' ? raw.lastInjectKey : ''
  s.lastAidAt = Number(raw.lastAidAt) || now
  s.deaths = Math.max(0, Math.round(Number(raw.deaths) || 0))
  s.deathLog = (Array.isArray(raw.deathLog) ? raw.deathLog : [])
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({ at: Number(x.at) || 0, id: String(x.id || ''), label: String(x.label || ''), severity: Math.round(Number(x.severity) || 0) }))
    .slice(0, 10)
  s.care = normalizeCare(raw.care)
  s.gone = (Array.isArray(raw.gone) ? raw.gone : [])
    .filter((g) => g && BY_ID.has(String(g.id)))
    .map((g) => ({ id: String(g.id), at: Number(g.at) || 0 }))
    .slice(0, 20)
  const seen = new Set()
  for (const item of Array.isArray(raw.active) ? raw.active : []) {
    const a = normalizeAffliction(item, now)
    if (!a || seen.has(a.id)) continue
    seen.add(a.id)
    s.active.push(a)
  }
  if (s.level > 0) {
    const want = levelInfo(s.level)?.count ?? 0
    s.active = s.active.slice(0, want)
  }
  s.updatedAt = now
  return s
}

/** 重抽：定等级 + 抽对应数量的病（默认保留已抽到的病里能留的，roll 时全换）。 */
export function reroll(state, level, rng = Math.random, { keep = false } = {}) {
  const lv = clamp(Math.round(Number(level) || rollLevel(rng)), 1, 5)
  const info = levelInfo(lv)
  const want = Math.min(info.count, POOL.length)
  const s = { ...state, level: lv, active: [], rolls: (state.rolls || 0) + 1, lastRollAt: Date.now(), gone: [] }
  if (keep && state.active?.length) {
    for (const a of state.active.slice(0, want)) s.active.push({ ...a })
  }
  const have = new Set(s.active.map((a) => a.id))
  const need = want - s.active.length
  if (need > 0) {
    const pool = POOL.filter((id) => !have.has(id))
    for (const id of drawDiseases(need, rng, pool)) s.active.push(newAffliction(id))
  }
  const now = Date.now()
  s.updatedAt = now
  return { state: s, level: lv, info }
}

/** 一轮结算：所有病一起加重。慢性稳定的病不再随轮次加重。 */
export function aggravate(state, cfg, minutes, now = Date.now(), rng = Math.random) {
  const info = levelInfo(state.level)
  const m = clamp(minutes, 0, cfg.maxPerTurnMin)
  const s = { ...state, active: state.active.map((a) => ({ ...a })), updatedAt: now }
  const events = []
  for (const a of s.active) {
    const d = BY_ID.get(a.id)
    if (!d) continue
    if (a.phase === 'chronic') {
      a.irritation = clamp100(a.irritation + (a.severity / 100) * 1.2 * (m / 12))
      continue
    }
    const relaxed = Number(a.reliefUntil) > now
    if (!relaxed) {
      const add = d.gain * (info?.gainMul ?? 1) * m * (1 + a.severity / 200) * (d.triggerWeight ?? 1)
      a.severity = clamp100(a.severity + add)
    }
    a.irritation = clamp100(a.irritation + (a.severity / 100) * 3 * (m / 12))
    if (a.severity >= cfg.flareAt && !relaxed && rng() < d.flareChance * (info?.flareMul ?? 1)) {
      const gain = clamp100(d.flareGain * (d.flareWeight ?? 1))
      a.severity = clamp100(a.severity + gain)
      a.irritation = clamp100(a.irritation + 12)
      a.flares += 1
      a.lastFlareAt = now
      events.push({ kind: 'flare', id: a.id, gain })
    }
  }
  return { state: s, events }
}

export function relieveOne(state, id, reliefId, now = Date.now()) {
  const d = BY_ID.get(id)
  const idx = state.active.findIndex((a) => a.id === id)
  if (!d || idx < 0) return { ok: false, state }
  const r = (d.reliefs || []).find((x) => x.id === reliefId) || d.reliefs?.[0]
  if (!r) return { ok: false, state }
  const s = { ...state, active: state.active.map((a, i) => (i === idx ? { ...a } : a)), lastAidAt: now, updatedAt: now }
  const a = s.active[idx]
  a.severity = clamp100(a.severity - Number(r.relief ?? 25))
  a.irritation = clamp100(a.irritation - Number(r.calm ?? 10))
  a.reliefUntil = now + Number(r.minutes ?? 25) * 60_000
  a.reliefKind = r.id
  return { ok: true, state: s, relief: r, disease: d }
}

export function cureAll(state, now = Date.now()) {
  return { ...state, level: 0, active: [], gone: [], lastAidAt: now, lastInjectAt: 0, lastInjectKey: '', updatedAt: now }
}

/* ------------------------------- 关心账本 ------------------------------- */

function dayKey(now) {
  const d = new Date(now)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function normalizeKind(kind) {
  const k = String(kind || '').trim()
  if (CARE_WEIGHTS[k]) return k
  if (k === '言语关心' || k === '关心' || k === '说') return 'words'
  if (k === '具体照顾' || k === '照顾' || k === '做') return 'care'
  if (k === '实质让步' || k === '让步' || k === '让') return 'concession'
  return 'words'
}

/**
 * 记一笔关心。必须带用户原话；同句去重、当日封顶。
 * 立即效果：目标病 severity -4×weight；长期效果：care.points 累积，让 tick 的恢复变快。
 */
export function addCare(state, cfg, input = {}, now = Date.now()) {
  const kind = normalizeKind(input.kind)
  const weight = CARE_WEIGHTS[kind]
  const quote = String(input.quote || '').trim().slice(0, 120)
  if (!quote) {
    return { ok: false, code: 'NO_QUOTE', message: '要带一句用户的原话（quote）。没有原话的关心不算，空话会被刷。' }
  }
  const day = dayKey(now)
  const s = { ...state, active: state.active.map((a) => ({ ...a })), care: { ...state.care, entries: [...(state.care?.entries || [])] }, lastAidAt: now, updatedAt: now }
  if (!s.care.day || s.care.day !== day) {
    s.care.day = day
    s.care.dayCount = 0
  }
  if (s.care.entries.some((e) => e.quote === quote)) {
    return { ok: false, code: 'DUPLICATE', message: '这句已经记过了。同一句话只算一次。' }
  }
  if (s.care.dayCount >= cfg.careDailyCap) {
    return { ok: false, code: 'DAILY_CAP', message: `今天已经记了 ${s.care.dayCount} 笔，上限 ${cfg.careDailyCap}。明天再说。` }
  }
  let target = null
  if (input.disease) {
    target = s.active.find((a) => a.id === String(input.disease)) || null
  }
  if (!target) target = worstOf(s, cfg, now)?.a || null
  s.care.points += weight
  s.care.dayCount += 1
  s.care.lastAt = now
  s.care.entries = [{ at: now, kind, weight, quote, target: target?.id || '' }, ...s.care.entries].slice(0, cfg.careEntriesMax)
  if (target) {
    const a = s.active.find((x) => x.id === target.id)
    if (a) {
      a.severity = clamp100(a.severity - weight * 4)
      a.irritation = clamp100(a.irritation - weight * 3)
    }
  }
  const after = target ? s.active.find((x) => x.id === target.id) : null
  return {
    ok: true,
    state: s,
    kind,
    kindLabel: CARE_KINDS[kind],
    weight,
    quote,
    target: target?.id || '',
    targetLabel: target ? BY_ID.get(target.id)?.label ?? target.id : '',
    severity: after ? Math.round(after.severity) : null,
    points: s.care.points,
    dayCount: s.care.dayCount,
    entry: s.care.entries[0],
  }
}

/** 删一笔（用户否认这次算关心）。按时间戳或下标。 */
export function dropCare(state, { at, index } = {}, now = Date.now()) {
  const s = { ...state, care: { ...state.care, entries: [...(state.care?.entries || [])] }, updatedAt: now }
  let i = -1
  if (Number.isFinite(Number(index))) i = Math.round(Number(index))
  else if (Number.isFinite(Number(at))) i = s.care.entries.findIndex((e) => Number(e.at) === Number(at))
  if (i < 0 || i >= s.care.entries.length) return { ok: false, state, message: '没找到这一笔。' }
  const [gone] = s.care.entries.splice(i, 1)
  s.care.points = Math.max(0, s.care.points - Number(gone.weight || 0))
  s.care.dayCount = Math.max(0, s.care.dayCount - 1)
  return { ok: true, state: s, entry: gone, points: s.care.points }
}

export function careSummary(state, cfg, now = Date.now()) {
  const c = state.care || newCare()
  const boost = 1 + Math.min(3, c.points / Math.max(1, cfg.careBoostPer))
  return {
    points: c.points,
    today: c.day === dayKey(now) ? c.dayCount : 0,
    dailyCap: cfg.careDailyCap,
    boost: Math.round(boost * 100) / 100,
    chronicAt: cfg.careChronicAt,
    entries: c.entries.slice(0, cfg.careEntriesMax).map((e) => ({
      at: e.at,
      kind: e.kind,
      kindLabel: CARE_KINDS[e.kind] || e.kind,
      weight: e.weight,
      quote: e.quote,
      target: e.target,
      targetLabel: e.target ? BY_ID.get(e.target)?.label ?? e.target : '',
    })),
  }
}

/** 慢性稳定：慢性病 + 难受值低 + 关心够 → 进入 chronic，不再主导语气。 */
function settleChronic(s, cfg) {
  const care = s.care?.points || 0
  for (const a of s.active) {
    if (a.phase === 'chronic') continue
    if (!CHRONIC_IDS.has(a.id)) continue
    if (a.severity <= 10 && care >= cfg.careChronicAt) a.phase = 'chronic'
  }
  return s
}

export function tick(state, cfg, now = Date.now(), minutes = 1) {
  const m = clamp(minutes, 0, 12 * 60)
  const s = { ...state, active: state.active.map((a) => ({ ...a })), updatedAt: now }
  const boost = 1 + Math.min(3, (s.care?.points || 0) / Math.max(1, cfg.careBoostPer))
  for (const a of s.active) {
    const floor = CHRONIC_IDS.has(a.id) ? cfg.chronicFloor : 0
    const relaxed = Number(a.reliefUntil) > now
    const rate = cfg.idleDecay * (relaxed ? 2.2 : 1) * boost
    a.severity = clamp100(Math.max(floor, a.severity - rate * m))
    if (a.severity <= floor && !CHRONIC_IDS.has(a.id)) a.severity = 0
    a.irritation = clamp100(a.irritation - (a.severity > 40 ? 0 : 0.25 * m * boost))
  }
  // 非慢性病归零即「好了」
  const still = []
  for (const a of s.active) {
    if (a.severity <= 0 && !CHRONIC_IDS.has(a.id)) {
      s.gone = [{ id: a.id, at: now }, ...(s.gone || [])].slice(0, 20)
      continue
    }
    still.push(a)
  }
  s.active = still
  return settleChronic(s, cfg)
}

export function modeOfAffliction(a, cfg, now = Date.now()) {
  if (a.phase === 'chronic') return 'chronic'
  if (Number(a.reliefUntil) > now) return 'relieved'
  if (Number(a.severity) >= cfg.flareAt) return 'flare'
  if (Number(a.severity) >= cfg.startAt) return 'ache'
  return 'calm'
}

export function worstOf(state, cfg, now = Date.now()) {
  let best = null
  let bestScore = -1
  for (const a of state.active) {
    const mode = modeOfAffliction(a, cfg, now)
    // 慢性稳定的不参与「主导」，只有发作时才算
    if (mode === 'chronic') continue
    const weight = mode === 'flare' ? 3 : mode === 'ache' ? 2 : mode === 'relieved' ? 1 : 0
    const score = a.severity + weight * 40
    if (score > bestScore) {
      bestScore = score
      best = { a, mode }
    }
  }
  return best
}

const EERIE_RULE = [
  '',
  '要求：这一轮最多一处细微表现（半句停顿、换个姿势、注意力飘走半秒），别影响正事。',
  '要求：把一句话说到一半被它打断一次，允许一个短促的声、一个没说完的句子；不解释自己怎么了。',
  '要求：允许出现不属于台词的碎片——同一个词重复两遍、把它当成一个正在跟你说话的东西、突然改用第三人称说自己的身体。别解释，别加括号注明这是什么效果。',
]

/** 拼成一段注入文本；只在最重的那个病到 ache 以上时才有内容。 */
export function buildBlock(state, cfg, now = Date.now(), opts = {}) {
  const info = levelInfo(state.level)
  const me = String(opts.name || '').trim() || '生病的肥鱼'
  const deaths = Math.max(0, Math.floor(Number(opts.deaths) || 0))
  if (!info || !state.active.length) {
    if (deaths > 0) {
      return {
        text: `（自我认知，别写进台词：你现在叫 ${me}——已经暴毙过 ${deaths} 次，这是第 ${deaths + 1} 具身体。除非用户问起，不要主动解释这件事；平时说话照旧。）`,
        key: `name:${deaths}`,
        mode: 'calm',
      }
    }
    return { text: '', key: 'none', mode: 'calm' }
  }
  const worst = worstOf(state, cfg, now)
  if (!worst) return { text: '', key: 'none', mode: 'calm' }
  const { a, mode } = worst
  const d = BY_ID.get(a.id)
  if (!d) return { text: '', key: 'none', mode: 'calm' }
  if (mode === 'calm') return { text: '', key: 'calm', mode }

  const lines = []
  if (mode === 'flare') {
    lines.push(d.body.flare, d.voice.flare || d.voice.base, `这一处已经发作过 ${a.flares} 次，最近一次就在刚才。允许这一轮明显比平时短。`)
  } else if (mode === 'relieved') {
    const r = (d.reliefs || []).find((x) => x.id === a.reliefKind)
    lines.push(`刚${r?.label || '处理过'}：这一处压住大半，但你清楚它只是被压住。`, '要求：最多提一句，别把话题拐到病上；正事照常。')
  } else {
    lines.push(d.body.ache, d.voice.base)
  }

  const eeriness = Math.max(0, Math.min(3, Math.round(d.eeriness ?? 2) + (state.level >= 4 ? 1 : 0) - (mode === 'relieved' ? 1 : 0)))
  if (eeriness > 0) lines.push(EERIE_RULE[eeriness])

  const others = state.active
    .filter((x) => x.id !== a.id && x.severity >= 12)
    .sort((p, q) => q.severity - p.severity)
    .slice(0, 4)
    .map((x) => `${BY_ID.get(x.id)?.label ?? x.id} ${Math.round(x.severity)}`)
  if (others.length) lines.push(`另外还有 ${others.length} 个在拖着：${others.join('、')}（它们不主导这一轮的语气，别一个个演）。`)

  const chronicList = state.active.filter((x) => x.phase === 'chronic').map((x) => BY_ID.get(x.id)?.label ?? x.id)
  if (chronicList.length) {
    lines.push(`已经慢下来的：${chronicList.join('、')}——它们不会好透，只是在背景里待着；除非用户问起，别提。`)
  }

  const care = state.care?.points || 0
  const careLine = care > 0 ? `有人在管你：累计关心 ${care} 点。` : '还没人管过你。'

  let text = [
    '（身体状态，别写进台词：这是你此刻真实的感受，不是给用户的说明）',
    `${me}｜等级 ${info.label}（Lv${info.level}）｜身上 ${state.active.length} 个病`,
    `${careLine}`,
    `主导：${d.label}｜难受 ${Math.round(a.severity)}/100`,
    lines.filter(Boolean).join('\n'),
  ].join('\n')

  const cap = Number(cfg.injectMaxChars) || 460
  if (text.length > cap) text = `${text.slice(0, Math.max(0, cap - 1))}…`
  return { text, key: `${mode}:${a.id}:${Math.round(a.severity / 10)}`, mode, leadId: a.id, eerie: eeriness }
}

export function shouldInject(state, cfg, block, now = Date.now()) {
  if (!block?.text) return { ok: false, skip: 'empty' }
  if (block.mode === 'flare' || block.mode === 'relieved') return { ok: true }
  const cool = Number(cfg.cooldownMin ?? 8) * 60_000
  const since = now - Number(state.lastInjectAt ?? 0)
  if (since < cool) return { ok: false, skip: 'cooldown' }
  if (block.key === state.lastInjectKey) {
    const hold = cool * Number(cfg.sameStateHoldFactor ?? 3)
    if (since < hold) return { ok: false, skip: 'same' }
  }
  return { ok: true }
}

export function summary(state, cfg, now = Date.now()) {
  const info = levelInfo(state.level)
  return {
    enabled: state.enabled,
    level: state.level,
    levelLabel: info?.label ?? '未开始',
    count: state.active.length,
    rolls: state.rolls,
    care: careSummary(state, cfg, now),
    gone: (state.gone || []).map((g) => ({ id: g.id, label: BY_ID.get(g.id)?.label ?? g.id, at: g.at })),
    deaths: Math.max(0, Number(state.deaths) || 0),
    lastAidAt: Number(state.lastAidAt) || 0,
    idleMin: Math.max(0, Math.round((now - (Number(state.lastAidAt) || now)) / 60000)),
    deathLog: (state.deathLog || []).slice(0, 10).map((x) => ({ at: x.at, id: x.id, label: x.label, severity: x.severity })),
    diseases: state.active
      .map((a) => ({
        id: a.id,
        label: BY_ID.get(a.id)?.label ?? a.id,
        severity: Math.round(a.severity),
        mode: modeOfAffliction(a, cfg, now),
        phase: a.phase,
        chronic: CHRONIC_IDS.has(a.id),
        flares: a.flares,
      }))
      .sort((p, q) => q.severity - p.severity),
  }
}

/* ------------------------------- 暴毙 ------------------------------- */

/**
 * 判定要不要暴毙：身上最重的那个病 >= deathAt，并且距最后一次「管它」
 * （care / relief / cure 都会刷新 lastAidAt）已经超过 deathAfterMin 分钟。
 * 只是判定，不改状态——写全局计数、重置身体是调用方的事。
 */
export function checkDeath(state, cfg, now = Date.now()) {
  if (!state || !Array.isArray(state.active) || !state.active.length) return null
  const at = Number(cfg?.deathAt) || DEFAULTS.deathAt
  const after = Number(cfg?.deathAfterMin) || DEFAULTS.deathAfterMin
  const lastAid = Number(state.lastAidAt) || 0
  const idleMin = (now - lastAid) / 60000
  if (!(idleMin >= after)) return null
  let worst = null
  for (const a of state.active) {
    if (!worst || Number(a.severity) > Number(worst.severity)) worst = a
  }
  if (!worst || Number(worst.severity) < at) return null
  return {
    at: now,
    id: worst.id,
    label: BY_ID.get(worst.id)?.label ?? worst.id,
    severity: Math.round(Number(worst.severity) || 0),
    idleMin: Math.round(idleMin),
  }
}

/** 暴毙之后：这具身体清空，等级保留（下次要自己重新抽病）。deaths 是「这一具身体死过几次」。 */
export function applyDeath(state, cfg, event, now = Date.now()) {
  const s = { ...state, active: [], lastAidAt: now, updatedAt: now }
  s.deaths = Math.max(0, Number(state.deaths) || 0) + 1
  s.deathLog = [event, ...(state.deathLog || [])].slice(0, 10)
  return s
}

/**
 * 自我认知里的名字：没死过就是「肥鱼」，死过一次变「肥鱼 2.0」，
 * 第二次「肥鱼 3.0」……（用户 m02244 定的规则）
 */
export function versionOf(deaths) {
  const n = Math.max(0, Math.floor(Number(deaths) || 0))
  return n <= 0 ? '肥鱼' : `肥鱼 ${n + 1}.0`
}

export const DISEASE_LIST = DISEASES
