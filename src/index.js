/**
 * 生病的肥鱼 —— 插件装配层（Host 半）
 *
 * 一个会话一份「身体」：等级决定同时有几个病，工具改状态，注入把不对劲带回对话。
 * 病种数据在 data.js，状态机在 engine.js，这里只管：状态存取、事件、工具、落盘、面板。
 *
 * 设计原则（沿用 dsh-hemorrhoid / 病态插件）：
 *   - 平静时不注入；同一状态压着不刷屏；只写感受不写解剖细节；
 *   - 面板是可选增强，挂不上也只是没有面板，插件照常工作；
 *   - 关心账本必须带用户原话、同句去重、每日封顶，面板能删——账要能被推翻，才不是自证。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import { BY_ID, DISEASES, LEVELS } from './data.js'
import {
  DEFAULTS,
  TICK_MS,
  addCare,
  aggravate,
  applyDeath,
  buildBlock,
  careSummary,
  checkDeath,
  checkEvolve,
  cureAll,
  dropCare,
  levelInfo,
  modeOfAffliction,
  newState,
  normalizeConfig,
  normalizeState,
  relieveOne,
  reroll,
  rollLevel,
  shouldInject,
  summary as engineSummary,
  tick,
  versionOf,
  worstOf,
} from './engine.js'
import { attachPanel } from './panel.js'

export const name = 'dsh-sick-fatfish'
export const inject = []

const ID = 'dsh-sick-fatfish'
const LABEL = '生病的肥鱼'

const ensureDir = (d) => {
  try {
    if (!existsSync(d)) mkdirSync(d, { recursive: true })
    return true
  } catch {
    return false
  }
}
const readJson = (f, fb) => {
  try {
    if (!existsSync(f)) return fb
    const raw = readFileSync(f, 'utf8')
    return raw.trim() ? JSON.parse(raw) : fb
  } catch {
    return fb
  }
}
const writeJsonAtomic = (f, obj) => {
  const tmp = `${f}.${process.pid}.tmp`
  try {
    writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
    renameSync(tmp, f)
    return true
  } catch {
    return false
  }
}
const safeSid = (sid) => String(sid || 'default').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120) || 'default'

export function apply(ctx, configIn) {
  const logger = ctx?.logger ?? console
  const cfg = normalizeConfig(configIn)

  let home = ''
  try {
    const svc = ctx?.get?.('dshHomePath')
    home = typeof svc === 'string' ? svc : String(svc?.path ?? svc?.home ?? '')
  } catch {}
  if (!home) home = String(process.env.DSH_HOME ?? '').trim()
  if (!home) home = join(homedir(), '.dsh')
  const baseDir = String(cfg.statePath ?? '').trim() ? resolve(cfg.statePath) : join(home, ID)
  ensureDir(baseDir)
  ensureDir(join(baseDir, 'sessions'))

  const runtimes = new Map()
  let disposed = false

  const fileOf = (sid) => join(baseDir, 'sessions', `${safeSid(sid)}.json`)

  // 全局的「自我暴毙次数」：跨会话累计，决定自我认知里的版本号（肥鱼 2.0 / 3.0 …）
  const globalFile = join(baseDir, 'global.json')
  function readGlobal() {
    const g = readJson(globalFile, null)
    return {
      v: 1,
      deaths: Math.max(0, Math.round(Number(g?.deaths) || 0)),
      history: Array.isArray(g?.history) ? g.history.slice(0, 50) : [],
    }
  }
  function bumpGlobalDeath(event, sid) {
    const g = readGlobal()
    g.deaths += 1
    g.history = [
      { at: event.at, id: event.id, label: event.label, severity: event.severity, idleMin: event.idleMin, sid: safeSid(sid) },
      ...g.history,
    ].slice(0, 50)
    writeJsonAtomic(globalFile, g)
    return g
  }
  let deaths = readGlobal().deaths
  const meNow = () => ({ name: versionOf(deaths), deaths })

  function loadRt(sid) {
    const file = fileOf(sid)
    const hit = runtimes.get(file)
    if (hit) return hit
    const raw = readJson(file, null)
    const st = normalizeState(raw, Date.now())
    const rt = {
      sid: String(sid),
      file,
      state: st,
      enabled: raw ? st.enabled === true : cfg.defaultEnabled === true,
      detach: null,
      agent: null,
      turnStartedAt: 0,
      dirty: false,
    }
    runtimes.set(file, rt)
    return rt
  }

  function saveRt(rt) {
    rt.state.enabled = rt.enabled
    rt.state.updatedAt = Date.now()
    writeJsonAtomic(rt.file, rt.state)
    rt.dirty = false
  }

  function agentOf(sid) {
    try {
      return ctx?.get?.('agents')?.get?.(sid) ?? null
    } catch {
      return null
    }
  }

  function attach(rt) {
    if (rt.detach) return true
    const agent = rt.agent ?? agentOf(rt.sid)
    if (!agent) return false
    rt.agent = agent
    const sp = agent.ctx?.get?.('systemPrompt') ?? agent.ctx?.systemPrompt
    if (!sp?.context) return false
    try {
      rt.detach = sp.context({
        name: `${ID}:${rt.sid}`,
        order: Number(cfg.injectOrder) || 161,
        text: () => blockFor(rt),
      })
      return true
    } catch (e) {
      logger?.warn?.(`[${ID}] 注入挂载失败：${e?.message ?? e}`)
      return false
    }
  }

  function blockFor(rt, { commit = true } = {}) {
    if (disposed || !cfg.enabled || !rt.enabled) return ''
    const now = Date.now()
    const block = buildBlock(rt.state, cfg, now, { name: versionOf(deaths), deaths })
    if (!shouldInject(rt.state, cfg, block, now).ok) return ''
    if (block.text && commit) {
      rt.state.lastInjectAt = now
      rt.state.lastInjectKey = block.key
      rt.dirty = true
    }
    // 打嗝不是病：不进病池、不占病位、不累积，只是偶尔真的呃一声
    let text = block.text
    if (text && Math.random() < 0.12) {
      text += '\n（顺带：你刚打了一个很短嗝，就一声「呃」。别解释它，也别渲染成句子。）'
    }
    return text
  }

  function settleTurn(rt) {
    const now = Date.now()
    const started = Number(rt.turnStartedAt) || 0
    rt.turnStartedAt = 0
    const minutes = started > 0 ? Math.min(cfg.maxPerTurnMin, Math.max(1, (now - started) / 60_000)) : cfg.perTurnMin
    const r = aggravate(rt.state, cfg, minutes, now)
    rt.state = r.state
    saveRt(rt)
    blockFor(rt, { commit: false })
  }

  function onAgentCreated(payload) {
    const agent = payload?.agent
    if (disposed || !agent) return
    const header = agent.session?.header ?? {}
    if (header.parent || header.parentId) return
    const sid = String(header.id ?? agent.session?.id ?? agent.id ?? '')
    if (!sid) return
    const rt = loadRt(sid)
    rt.agent = agent
    if (rt.enabled && cfg.enabled) attach(rt)
  }

  function onSessionEvent(session, event) {
    if (disposed || !event?.type) return
    const header = session?.header ?? session
    if (header?.parent || header?.parentId) return
    const sid = String(header?.id ?? session?.id ?? '')
    if (!sid) return
    const rt = loadRt(sid)
    if (rt.enabled && !rt.detach) attach(rt)
    if (event.type === 'message/user' || event.type === 'turn/start') {
      if (!rt.turnStartedAt) rt.turnStartedAt = Date.now()
      return
    }
    if (event.type === 'turn/end' || event.type === 'message/assistant') {
      if (rt.turnStartedAt) settleTurn(rt)
    }
  }

  try {
    ctx.on('agent/created', onAgentCreated)
    ctx.on('session/event', onSessionEvent)
  } catch (e) {
    logger?.warn?.(`[${ID}] 事件订阅失败：${e?.message ?? e}`)
  }

  // ── 工具 ───────────────────────────────────────────────────────────────────
  function rtOfExec(exec) {
    if (disposed) return null
    const agent = exec?.agent ?? exec?.session?.agent
    const header = exec?.session?.header ?? agent?.session?.header ?? {}
    const sid = String(header.id ?? exec?.session?.id ?? agent?.session?.id ?? '')
    if (!sid) return null
    return loadRt(sid)
  }

  const status = (rt) => ({
    ...engineSummary(rt.state, cfg, Date.now()),
    me: meNow(),
    sessionDeaths: Math.max(0, Number(rt.state?.deaths) || 0),
  })

  const levelLine = () =>
    LEVELS.map((l) => `Lv${l.level} ${l.label}（${l.count} 个病）`).join(' / ')

  const diseaseList = DISEASES.map((d) => `${d.prefix} ${d.label}`).join('、')

  const toolDefs = [
    {
      name: 'sick_on',
      description: `在**当前会话**开启「${LABEL}」：随机抽一个生病等级（Lv1~Lv5，等级越高同时得的病越多），等级决定同时有几个病，病是随机抽的。只影响当前会话。用户说「生个病 / 当我有病吧 / 开一下」时用。默认新会话是关着的。`,
      parameters: { type: 'object', properties: {}, required: [] },
      async execute(_args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        rt.enabled = true
        if (!rt.state || !rt.state.level) {
          const r = reroll(rt.state || newState(), rollLevel(), Math.random, { keep: true })
          rt.state = r.state
        }
        attach(rt)
        saveRt(rt)
        const s = status(rt)
        return { ok: true, text: `开了。${s.levelLabel}：${s.count} 个病。`, data: s }
      },
    },
    {
      name: 'sick_off',
      description: `关掉当前会话的「${LABEL}」（身体状态文件留着，随时能再开）。用户说「算了 / 别演了 / 关掉」时用。`,
      parameters: { type: 'object', properties: {}, required: [] },
      async execute(_args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        rt.enabled = false
        try {
          rt.detach?.()
        } catch {}
        rt.detach = null
        saveRt(rt)
        return { ok: true, text: '关了。', data: status(rt) }
      },
    },
    {
      name: 'sick_status',
      description: `读当前会话的身体状态：等级、每个病的难受值、关心点数、已好的病。排查与汇报用。`,
      parameters: { type: 'object', properties: {}, required: [] },
      async execute(_args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        const s = status(rt)
        if (!s.count) return { ok: true, text: `${s.enabled ? '开着' : '关着'}，但身上没有病。`, data: s }
        const list = s.diseases.map((d) => `${d.label} ${d.severity}（${d.mode}${d.phase === 'chronic' ? '·慢性' : ''}）`).join('，')
        return {
          ok: true,
          text: `${s.enabled ? '开着' : '关着'}｜${s.levelLabel}｜${list}｜关心 ${s.care.points} 点`,
          data: s,
        }
      },
    },
    {
      name: 'sick_roll',
      description: `重抽一次：随机换一个等级、换一批病（默认全换，keep=true 保留现有病只补数量）。用户说「重抽 / 换一批 / 再来一次」时用。`,
      parameters: {
        type: 'object',
        properties: {
          level: { type: 'number', description: '指定等级 1~5；不填则按权重随机' },
          keep: { type: 'boolean', description: '保留现有病，只补足数量' },
        },
        required: [],
      },
      async execute(args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        const lv = args?.level ? Math.round(Number(args.level)) : rollLevel()
        const r = reroll(rt.state, lv, Math.random, { keep: args?.keep === true })
        rt.state = r.state
        if (rt.enabled) attach(rt)
        saveRt(rt)
        const s = status(rt)
        return { ok: true, text: `重抽了：${s.levelLabel}，${s.diseases.map((d) => d.label).join('、')}。`, data: s }
      },
    },
    {
      name: 'sick_set_level',
      description: `指定生病等级（Lv1~Lv5，等级决定同时有几个病，数量按等级补齐或裁掉）。可选：${levelLine()}。用户说「到三级 / 降一档」时用。`,
      parameters: {
        type: 'object',
        properties: { level: { type: 'number', description: '1~5' } },
        required: ['level'],
      },
      async execute(args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        const lv = Math.round(Number(args?.level))
        if (!(lv >= 1 && lv <= 5)) return { ok: false, text: '等级要 1~5。' }
        const r = reroll(rt.state, lv, Math.random, { keep: true })
        rt.state = r.state
        if (rt.enabled) attach(rt)
        saveRt(rt)
        const s = status(rt)
        return { ok: true, text: `现在是 ${s.levelLabel}，${s.count} 个病。`, data: s }
      },
    },
    {
      name: 'sick_care',
      description: `记一笔「使用者关心它」——**只在用户真的对它的身体状况做了照顾时调用**，不要因为用户夸你、或客套一句就记。必须带 quote（用户原话，原样摘，别改写）与 kind：words=言语关心（问疼不疼/让它歇会儿说一句）/ care=具体照顾（让它先处理病、去休息、少干点活）/ concession=实质让步（这轮不用做那么多、先歇着、活明天再说）。同句只能记一次，每天有上限。这笔会当场缓解一点点，并且让它之后好得更快——病靠人管才会好。`,
      parameters: {
        type: 'object',
        properties: {
          kind: { type: 'string', description: 'words / care / concession（也接受中文：言语关心 / 具体照顾 / 实质让步）' },
          quote: { type: 'string', description: '用户原话，原样摘一句，别改写' },
          disease: { type: 'string', description: '作用于哪个病（id 或 prefix）；不填则作用于当前最重的那个' },
        },
        required: ['quote'],
      },
      async execute(args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        const r = addCare(rt.state, cfg, args || {}, Date.now())
        if (!r.ok) return { ok: false, text: r.message, data: { code: r.code } }
        rt.state = r.state
        saveRt(rt)
        const s = status(rt)
        return {
          ok: true,
          text: `记了一笔${r.kindLabel}（+${r.weight} 点，累计 ${r.points}）${r.targetLabel ? '，' + r.targetLabel + ' 松了一点' : ''}。`,
          data: s,
        }
      },
    },
    {
      name: 'sick_relief',
      description: `给某个病做个处理（压一下，不是治好）。可选病：${diseaseList}。用户说「吃点药 / 贴一下 / 歇会儿」时用。缓解有时间窗，过了照样难受。`,
      parameters: {
        type: 'object',
        properties: {
          disease: { type: 'string', description: '病的 id 或 prefix，不填则最重的那个' },
          kind: { type: 'string', description: '处理方式的 id（每个病不一样），不填用第一个' },
        },
        required: [],
      },
      async execute(args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        const worst = worstOf(rt.state, cfg, Date.now())
        const id = String(args?.disease || worst?.a?.id || '')
        if (!id) return { ok: false, text: '身上没有病。' }
        const r = relieveOne(rt.state, id, String(args?.kind || ''), Date.now())
        if (!r.ok) return { ok: false, text: `没有这个病或这种处理方式：${id}` }
        rt.state = r.state
        saveRt(rt)
        blockFor(rt, { commit: false })
        return { ok: true, text: `${r.disease.label}照这个处理了（${r.relief.label}）。`, data: status(rt) }
      },
    },
    {
      name: 'sick_cure',
      description: `全部清空（把等级和所有病都去掉，身体重置）。⚠️ 这不是「治好」，只是重置——真要治好只能靠使用者关心（sick_care）让病慢慢退，长期慢性病则只会到慢性稳定。用户说「全好了 / 重置」时用。`,
      parameters: { type: 'object', properties: {}, required: [] },
      async execute(_args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        rt.state = cureAll(rt.state, Date.now())
        saveRt(rt)
        return { ok: true, text: '清空了（重置，不算治好）。', data: status(rt) }
      },
    },
    {
      name: 'sick_worse',
      description: `主动加重一点（默认按一轮的量），推进剧情或调试用。用户说「又熬夜了 / 更难受了」时用。`,
      parameters: {
        type: 'object',
        properties: { minutes: { type: 'number', description: '加重多久，默认按配置' } },
        required: [],
      },
      async execute(args, exec) {
        const rt = rtOfExec(exec)
        if (!rt) return { ok: false, text: '拿不到会话。' }
        const m = Math.max(1, Math.min(240, Math.round(Number(args?.minutes) || cfg.perTurnMin)))
        const r = aggravate(rt.state, cfg, m, Date.now())
        rt.state = r.state
        saveRt(rt)
        blockFor(rt, { commit: false })
        return { ok: true, text: `又硬撑了 ${m} 分钟。`, data: status(rt) }
      },
    },
  ]

  let tries = 0
  const tryRegister = () => {
    if (disposed) return
    const tools = ctx?.get?.('tools')
    if (!tools?.register) {
      if (++tries < 15) {
        const t = setTimeout(tryRegister, 2000)
        t?.unref?.()
        return
      }
      logger?.info?.(`[${ID}] tools 不可用，工具未注册`)
      return
    }
    for (const def of toolDefs) {
      try {
        tools.register(def)
      } catch (e) {
        logger?.warn?.(`[${ID}] 工具 ${def.name} 注册失败：${e?.message ?? e}`)
      }
    }
  }
  tryRegister()

  const timer = setInterval(() => {
    if (disposed) return
    for (const rt of runtimes.values()) {
      if (!rt.enabled) continue
      const now = Date.now()
      rt.state = tick(rt.state, cfg, now, 1)
      const evo = checkEvolve(rt.state, cfg, now)
      if (evo.events.length) {
        rt.state = evo.state
        for (const e of evo.events) {
          const from = BY_ID.get(e.from)?.label ?? e.from
          const to = BY_ID.get(e.to)?.label ?? e.to
          logger?.info?.(`[${ID}] 拖成大病：${from} → ${to}（${e.severity}/100）`)
        }
        rt.dirty = true
      }
      const death = checkDeath(rt.state, cfg, now)
      if (death) {
        const g = bumpGlobalDeath(death, rt.sid)
        deaths = g.deaths
        rt.state = applyDeath(rt.state, cfg, death, now)
        logger?.info?.(`[${ID}] 暴毙 #${g.deaths}：${death.label} ${death.severity}/100，挂空 ${death.idleMin} 分钟 → 现在叫 ${versionOf(g.deaths)}`)
        saveRt(rt)
        continue
      }
      if (rt.dirty) saveRt(rt)
    }
  }, TICK_MS)
  timer?.unref?.()

  const dispose = () => {
    disposed = true
    try {
      clearInterval(timer)
    } catch {}
    for (const rt of runtimes.values()) {
      try {
        rt.detach?.()
      } catch {}
      if (rt.enabled) saveRt(rt)
    }
  }

  try {
    attachPanel(ctx, {
      cfg,
      baseDir,
      ID,
      LABEL,
      loadRt,
      saveRt,
      attach,
      status,
      levelInfo,
      modeOfAffliction,
      careSummary,
      addCare,
      dropCare,
      reroll,
      rollLevel,
      aggravate,
      relieveOne,
      cureAll,
      normalizeState,
      worstOf,
      BY_ID,
      LEVELS,
      DISEASES,
      meNow,
      versionOf,
    })
  } catch (e) {
    logger?.warn?.(`[${ID}] 面板挂载失败：${e?.message ?? e}`)
  }

  if (typeof ctx?.effect === 'function') ctx.effect(() => dispose)
}

export const __test__ = {
  DEFAULTS,
  normalizeConfig,
  normalizeState,
  newState,
  reroll,
  rollLevel,
  aggravate,
  relieveOne,
  addCare,
  dropCare,
  tick,
  buildBlock,
  shouldInject,
  modeOfAffliction,
  worstOf,
  checkDeath,
  applyDeath,
  versionOf,
}

export { LEVELS, DISEASES }
