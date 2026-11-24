/**
 * 生病的肥鱼 · 离线自检（不安装、不起宿主）
 *
 *   node test/verify.mjs
 *
 * 覆盖：病种池与等级表、抽等级分布、抽病不重复、加重/发作、自然衰减与关心加速、
 * 慢性病地板与慢性转换、关心账本（无原话/重复/每日上限/权重/即时缓解/删除）、
 * 注入块与冷却、假 ctx 装配（9 个工具 + 注入挂载 + 事件 + 落盘）、面板路由、静态契约。
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { BY_ID, DISEASES, LEVELS, LEVEL_WEIGHTS, POOL } from '../src/data.js'
import {
  CHRONIC_IDS,
  DEFAULTS,
  addCare,
  aggravate,
  buildBlock,
  careSummary,
  checkDeath,
  applyDeath,
  versionOf,
  cureAll,
  dropCare,
  newState,
  normalizeConfig,
  normalizeState,
  relieveOne,
  reroll,
  rollLevel,
  shouldInject,
  summary,
  tick,
  worstOf,
} from '../src/engine.js'

let pass = 0
let fail = 0
const ok = (cond, name) => {
  if (cond) {
    pass += 1
  } else {
    fail += 1
    console.error('FAIL  ' + name)
  }
}
const eq = (a, b, name) => ok(Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b), `${name}（得到 ${JSON.stringify(a)}，期望 ${JSON.stringify(b)}）`)
const cfg = normalizeConfig({})

/* ------------------------------ 1. 数据 ------------------------------ */
eq(DISEASES.length, 20, '病种 20 个')
eq(POOL.length, 20, 'POOL 20 个')
eq(LEVELS.length, 5, '等级 5 档')
eq(LEVEL_WEIGHTS.reduce((a, b) => a + b, 0), 100, '等级权重合计 100')
for (const l of LEVELS) ok(l.count === l.level, `Lv${l.level} 病数 = ${l.count}`)
for (const d of DISEASES) {
  ok(typeof d.body?.ache === 'string' && d.body.ache.length > 4, `${d.id} 有 ache 文案`)
  ok(typeof d.voice?.base === 'string' && d.voice.base.length > 4, `${d.id} 有 voice`)
  ok(Array.isArray(d.reliefs) && d.reliefs.length > 0, `${d.id} 有缓解方式`)
}
eq(new Set(DISEASES.map((d) => d.id)).size, 20, '病 id 不重复')
eq(CHRONIC_IDS.size, 8, '长期慢性病 8 个')
for (const id of CHRONIC_IDS) ok(BY_ID.has(id), `慢性病在池子里：${id}`)

/* --------------------------- 2. 抽等级分布 --------------------------- */
{
  const counts = [0, 0, 0, 0, 0]
  for (let i = 0; i < 20000; i += 1) counts[rollLevel() - 1] += 1
  ok(counts.every((c) => c > 500), '抽等级 2 万次，五档都出现')
  ok(counts[0] > counts[4], 'Lv1 比 Lv5 常见')
}

/* ------------------------------ 3. 抽病 ------------------------------ */
{
  const s = newState()
  for (let lv = 1; lv <= 5; lv += 1) {
    const r = reroll(s, lv, () => 0.42)
    eq(r.state.active.length, lv, `Lv${lv} 抽到 ${lv} 个病`)
    eq(new Set(r.state.active.map((a) => a.id)).size, lv, `Lv${lv} 病不重复`)
    eq(r.state.level, lv, `Lv${lv} 等级写入`)
  }
  const keep = reroll(s, 3, () => 0.1, { keep: true })
  const again = reroll(keep.state, 3, () => 0.1, { keep: true })
  ok(again.state.active.every((a) => keep.state.active.some((b) => b.id === a.id)), 'keep=true 保留原有病')
}

/* --------------------------- 4. 加重与发作 --------------------------- */
{
  const st = reroll(newState(), 3, () => 0.3).state
  const r = aggravate(st, cfg, 30, Date.now(), () => 0.999)
  ok(r.state.active.every((a, i) => a.severity >= st.active[i].severity), '加重后每个病都不降')
  ok(r.state.active.some((a) => a.severity > 0), '加重有实际数值')
  // rng()=0 必触发 flare（severity 够高时）
  const hot = reroll(newState(), 5, () => 0.1).state
  for (const a of hot.active) a.severity = 90
  const flare = aggravate(hot, cfg, 30, Date.now(), () => 0)
  ok(flare.events.length > 0, '达到阈值 + rng=0 会发作')
  ok(flare.state.active.some((a) => a.flares === 1), '发作次数 +1')
}

/* ------------------------- 5. 衰减与关心加速 ------------------------- */
{
  const mk = () => {
    const s = reroll(newState(), 2, () => 0.2).state
    for (const a of s.active) a.severity = 60
    return s
  }
  const plain = tick(mk(), cfg, Date.now(), 10)
  ok(plain.active.every((a) => a.severity < 60), '自然衰减会降')
  const cared = { ...mk(), care: { points: 48, entries: [], lastAt: 0, day: '', dayCount: 0 } }
  const fast = tick(cared, cfg, Date.now(), 10)
  ok(fast.active.every((a, i) => a.severity <= plain.active[i].severity), '关心点高时衰减不慢于自然衰减')
  ok(fast.active.some((a, i) => a.severity < plain.active[i].severity), '关心点高时至少一个病掉得更快')
}

/* --------------------------- 6. 慢性与治愈 --------------------------- */
{
  // 慢性病有地板
  const chronicId = [...CHRONIC_IDS].find((id) => id !== 'dsh-nobody') || ''
  const s = { ...newState(), level: 1, active: [{ ...newState().active, id: chronicId, severity: 3, irritation: 0, flares: 0, lastFlareAt: 0, reliefUntil: 0, reliefKind: '', phase: 'active', addedAt: 0 }] }
  const t = tick(s, cfg, Date.now(), 120)
  ok(t.active[0].severity >= cfg.chronicFloor, `慢性病不低于地板 ${cfg.chronicFloor}`)

  // 非慢性病归零 → gone
  const acute = DISEASES.find((d) => !CHRONIC_IDS.has(d.id))
  const s2 = { ...newState(), level: 1, active: [{ ...newState().active, id: acute.id, severity: 1, irritation: 0, flares: 0, lastFlareAt: 0, reliefUntil: 0, reliefKind: '', phase: 'active', addedAt: 0 }] }
  const t2 = tick(s2, cfg, Date.now(), 60)
  eq(t2.active.length, 0, '非慢性病归零后离开身体')
  eq(t2.gone.length, 1, '归零记进 gone')

  // 慢性转换：慢性病 + 难受<=10 + 关心够
  const s3 = {
    ...newState(),
    level: 1,
    care: { points: cfg.careChronicAt, entries: [], lastAt: 0, day: '', dayCount: 0 },
    active: [{ ...newState().active, id: chronicId, severity: 5, irritation: 0, flares: 0, lastFlareAt: 0, reliefUntil: 0, reliefKind: '', phase: 'active', addedAt: 0 }],
  }
  const t3 = tick(s3, cfg, Date.now(), 1)
  eq(t3.active[0].phase, 'chronic', '够关心 + 够低 → 转慢性')
  ok(worstOf(t3, cfg, Date.now()) === null, '慢性状态下不主导语气')
}

/* ----------------------------- 6b. 暴毙 ----------------------------- */
{
  const NOW = 1_700_000_000_000
  const MIN = 60_000
  const TID = 'dsh-tinnitus'
  const mk = (severity, idleMin) => ({
    ...newState(NOW - idleMin * MIN),
    level: 3,
    lastAidAt: NOW - idleMin * MIN,
    active: [{ id: TID, severity, irritation: 0, flares: 0, lastFlareAt: 0, reliefUntil: 0, reliefKind: '', phase: 'active', addedAt: NOW - idleMin * MIN }],
  })

  eq(DEFAULTS.deathAt, 96, '默认暴毙阈值 96')
  eq(DEFAULTS.deathAfterMin, 240, '默认挂空 240 分钟')

  eq(versionOf(0), '肥鱼', '没死过叫「肥鱼」')
  eq(versionOf(1), '肥鱼 2.0', '第一次暴毙 → 2.0')
  eq(versionOf(2), '肥鱼 3.0', '第二次暴毙 → 3.0')
  eq(versionOf(5), '肥鱼 6.0', '第五次暴毙 → 6.0')

  eq(checkDeath(mk(95, 300), cfg, NOW), null, '难受 95（不到 96）不暴毙')
  eq(checkDeath(mk(99, 60), cfg, NOW), null, '挂空 60 分钟（不到 240）不暴毙')
  const d = checkDeath(mk(99, 300), cfg, NOW)
  ok(d && d.id === TID && d.severity === 99 && d.idleMin === 300, '病入膏肓 + 挂空 300 分钟 → 暴毙')

  const cared = addCare(mk(99, 300), cfg, { kind: 'care', quote: '先去躺会儿，别管那个' }, NOW).state
  eq(checkDeath(cared, cfg, NOW), null, '刚记过一笔关心 → 不算挂空')

  const tid = BY_ID.get(TID)?.reliefs?.[0]?.id || ''
  const relieved = relieveOne(mk(99, 300), TID, tid, NOW).state
  eq(relieved.lastAidAt, NOW, '刚处理过 → 挂空起点刷新')
  eq(checkDeath(relieved, cfg, NOW), null, '刚处理过 → 不算挂空')

  const dead = applyDeath(mk(99, 300), cfg, d, NOW)
  eq(dead.active.length, 0, '暴毙后身上清空')
  eq(dead.deaths, 1, '本会话暴毙计数 +1')
  eq(dead.deathLog.length, 1, '暴毙进 deathLog')
  eq(dead.deathLog[0].id, TID, 'deathLog 记的是哪个病')
  eq(dead.lastAidAt, NOW, '暴毙后重置挂空起点')

  const b = buildBlock(
    { ...mk(90, 0), care: { points: 4, entries: [], lastAt: 0, day: '', dayCount: 0 }, lastAidAt: NOW },
    cfg,
    NOW,
    { name: versionOf(1) },
  )
  ok(b.text.includes('肥鱼 2.0｜等级'), '注入标题带自我认知版本号')

  const nameOnly = buildBlock({ ...newState(NOW), level: 0, active: [] }, cfg, NOW, { name: versionOf(2), deaths: 2 })
  ok(nameOnly.text.includes('肥鱼 3.0') && nameOnly.text.includes('暴毙过 2 次'), '没病时也记得自己叫肥鱼 3.0')
  eq(buildBlock({ ...newState(NOW), level: 0, active: [] }, cfg, NOW).text, '', '没死过又没病 → 不注入')
}

/* ----------------------------- 7. 关心账本 ---------------------------- */
{
  const base = () => reroll(newState(), 2, () => 0.25).state
  const now = Date.now()

  const r1 = addCare(base(), cfg, { kind: 'words' }, now)
  eq(r1.ok, false, '没有原话就拒绝')
  eq(r1.code, 'NO_QUOTE', '拒绝码 NO_QUOTE')

  const s = base()
  const worstId = worstOf(s, cfg, now).a.id
  s.active.find((a) => a.id === worstId).severity = 50
  const before = 50
  const r2 = addCare(s, cfg, { kind: 'care', quote: '你先歇会儿' }, now)
  ok(r2.ok, '带原话能记')
  eq(r2.weight, 2, '具体照顾权重 2')
  eq(r2.points, 2, '点数累加')
  const after = r2.state.active.find((a) => a.id === worstId).severity
  ok(after < before, '记一笔会当场缓解')
  eq(r2.target, worstId, '默认作用于最重的病')

  const r3 = addCare(r2.state, cfg, { kind: 'care', quote: '你先歇会儿' }, now + 1000)
  eq(r3.code, 'DUPLICATE', '同句去重')

  const r4 = addCare(r2.state, cfg, { kind: 'concession', quote: '这轮不用你干活了' }, now + 2000)
  eq(r4.weight, 3, '实质让步权重 3')
  eq(r4.points, 5, '累计 5')

  // 每日上限
  let st = base()
  let capped = null
  for (let i = 0; i <= cfg.careDailyCap; i += 1) {
    const r = addCare(st, cfg, { kind: 'words', quote: '第 ' + i + ' 次关心' }, now + i * 1000)
    if (!r.ok) {
      capped = r
      break
    }
    st = r.state
  }
  ok(capped && capped.code === 'DAILY_CAP', '超过每日上限被拒')

  // 删除回退
  const d1 = addCare(base(), cfg, { kind: 'words', quote: '疼不疼' }, now)
  const d2 = addCare(d1.state, cfg, { kind: 'care', quote: '去躺着吧' }, now + 1000)
  eq(d2.points, 3, '两条共 3 点')
  const d3 = dropCare(d2.state, { at: d2.entry.at }, now + 2000)
  ok(d3.ok, '能删掉一笔')
  eq(d3.points, 1, '删掉权重 2 的那笔后剩 1')
  eq(d3.state.care.entries.length, 1, '账本剩 1 条')

  // 指定病
  const s5 = base()
  const other = s5.active.find((a) => a.id !== worstIdsafe(s5, cfg, now))
  if (other) {
    const r = addCare(s5, cfg, { kind: 'words', quote: '那个地方也疼吗', disease: other.id }, now)
    eq(r.target, other.id, '能指定作用的病')
  }

  const sum = careSummary(d2.state, cfg, now)
  ok(sum.points === 3 && sum.today === 2, '账本汇总点数与今日条数')
  ok(sum.boost > 1, '关心点会提升恢复倍率')
}

function worstIdsafe(s, c, now) {
  return worstOf(s, c, now)?.a?.id || ''
}

/* --------------------------- 8. 注入与冷却 --------------------------- */
{
  const calm = { ...newState(), level: 1, active: [{ ...newState().active, id: DISEASES[0].id, severity: 0, irritation: 0, flares: 0, lastFlareAt: 0, reliefUntil: 0, reliefKind: '', phase: 'active', addedAt: 0 }] }
  eq(buildBlock(calm, cfg, Date.now()).text, '', '平静时不注入')

  const ache = { ...newState(), level: 2, active: [{ ...newState().active, id: DISEASES[1].id, severity: 60, irritation: 0, flares: 0, lastFlareAt: 0, reliefUntil: 0, reliefKind: '', phase: 'active', addedAt: 0 }] }
  const block = buildBlock(ache, cfg, Date.now())
  ok(block.text.includes('生病的肥鱼'), '注入块带标题')
  ok(block.text.includes('还没人管过你'), '没人关心时写出来')

  const cared = { ...ache, care: { points: 10, entries: [], lastAt: 0, day: '', dayCount: 0 } }
  ok(buildBlock(cared, cfg, Date.now()).text.includes('累计关心 10 点'), '有关心时写点数')

  const si = shouldInject(ache, cfg, block, Date.now())
  ok(si.ok, '首次注入允许')
  const st2 = { ...ache, lastInjectAt: Date.now(), lastInjectKey: block.key }
  eq(shouldInject(st2, cfg, block, Date.now()).skip, 'cooldown', '冷却期内跳过')
  const flareBlock = { ...block, mode: 'flare' }
  ok(shouldInject(st2, cfg, flareBlock, Date.now()).ok, '发作不受冷却限制')
}

/* ------------------------- 9. 假 ctx 装配 ------------------------- */
{
  const home = mkdtempSync(join(tmpdir(), 'sick-'))
  const { apply, __test__, name } = await import('../src/index.js')
  eq(name, 'dsh-sick-fatfish', '导出 name 正确')
  ok(__test__ && typeof __test__.addCare === 'function', '__test__ 暴露引擎函数')

  const tools = []
  const listeners = {}
  const webRoutes = []
  const effects = []
  const injectedContexts = []
  const fakeAgent = {
    id: 'session-test-1',
    session: { header: { id: 'session-test-1' }, id: 'session-test-1' },
    ctx: {
      get(k) {
        if (k === 'systemPrompt') {
          return {
            context(o) {
              injectedContexts.push(o)
              return () => {
                o.__detached = true
              }
            },
          }
        }
        return null
      },
    },
  }

  const ctx = {
    logger: { warn() {}, info() {} },
    get(k) {
      if (k === 'dshHomePath') return home
      if (k === 'tools') return { register: (def) => tools.push(def) }
      if (k === 'agents') return { get: (sid) => (sid === 'session-test-1' ? fakeAgent : null) }
      if (k === 'webServer')
        return {
          register: (r) => {
            webRoutes.push(r)
            return () => {}
          },
        }
      return null
    },
    on(evt, fn) {
      listeners[evt] = listeners[evt] || []
      listeners[evt].push(fn)
    },
    inject(names, cb) {
      if (names.includes('webServer')) {
        cb({
          webServer: ctx.get('webServer'),
          // 真宿主的 effect 会立刻执行一次；这里照做，否则路由根本不会注册
          effect: (fn) => {
            try {
              fn()
            } catch {}
          },
        })
      }
    },
    effect(fn) {
      effects.push(fn)
    },
  }

  apply(ctx, {})
  eq(tools.length, 9, '注册 9 个工具')
  const names = tools.map((t) => t.name)
  const want = ['sick_on', 'sick_off', 'sick_status', 'sick_roll', 'sick_set_level', 'sick_care', 'sick_relief', 'sick_cure', 'sick_worse']
  ok(want.every((n) => names.includes(n)), '9 个工具名齐全')
  eq(webRoutes.length, 2, '注册 2 条面板路由')
  ok(webRoutes.some((r) => r.path === '/dsh-sick-fatfish/panel'), '快照路由存在')
  ok(webRoutes.some((r) => r.path === '/dsh-sick-fatfish/panel/action'), '动作路由存在')

  // 开 + 抽（sick_on 会顺带把注入挂上）
  const exec = { agent: fakeAgent, session: fakeAgent.session }
  const onTool = tools.find((t) => t.name === 'sick_on')
  const on = await onTool.execute({}, exec)
  ok(on.ok, 'sick_on 能开')
  ok(on.data.count >= 1 && on.data.count <= 5, '开了之后有 1~5 个病')

  eq(injectedContexts.length, 1, '开的时候挂上注入')
  eq(injectedContexts[0].order, 161, '注入 order 161')

  // agent/created 再来一次不应该重复挂
  listeners['agent/created']?.forEach((fn) => fn({ agent: fakeAgent }))
  eq(injectedContexts.length, 1, '重复 agent/created 不重复挂注入')

  const statusTool = tools.find((t) => t.name === 'sick_status')
  const st = await statusTool.execute({}, exec)
  ok(st.ok && st.data.count >= 1, 'sick_status 能读')

  const careTool = tools.find((t) => t.name === 'sick_care')
  const c1 = await careTool.execute({ kind: 'concession', quote: '这轮先歇着' }, exec)
  ok(c1.ok, 'sick_care 能记')
  const c2 = await careTool.execute({ kind: 'concession', quote: '这轮先歇着' }, exec)
  eq(c2.ok, false, '同句第二次被拒')
  const c3 = await careTool.execute({ kind: 'words' }, exec)
  eq(c3.ok, false, '没有 quote 被拒')

  const reliefTool = tools.find((t) => t.name === 'sick_relief')
  const rl = await reliefTool.execute({}, exec)
  ok(rl.ok, 'sick_relief 能处理最重的病')

  const worseTool = tools.find((t) => t.name === 'sick_worse')
  const w = await worseTool.execute({ minutes: 12 }, exec)
  ok(w.ok, 'sick_worse 能加重')

  const rollTool = tools.find((t) => t.name === 'sick_roll')
  const rl2 = await rollTool.execute({ level: 5 }, exec)
  eq(rl2.data.count, 5, '重抽到 Lv5 有 5 个病')

  const setTool = tools.find((t) => t.name === 'sick_set_level')
  const s2 = await setTool.execute({ level: 1 }, exec)
  eq(s2.data.count, 1, '指定 Lv1 只剩 1 个病')
  const bad = await setTool.execute({ level: 9 }, exec)
  eq(bad.ok, false, '越界等级被拒')

  const cureTool = tools.find((t) => t.name === 'sick_cure')
  const cur = await cureTool.execute({}, exec)
  eq(cur.data.count, 0, '清空后没有病')

  // 落盘
  const file = join(home, 'dsh-sick-fatfish', 'sessions', 'session-test-1.json')
  ok(existsSync(file), '状态落盘到 <home>/dsh-sick-fatfish/sessions/')
  const disk = JSON.parse(readFileSync(file, 'utf8'))
  eq(disk.enabled, true, '落盘文件里有开关')

  // 面板快照
  const snapRoute = webRoutes.find((r) => r.path === '/dsh-sick-fatfish/panel')
  let body = null
  await snapRoute.handler({ method: 'GET', url: '/dsh-sick-fatfish/panel' }, { statusCode: 0, setHeader() {}, end(s) { body = JSON.parse(s) } })
  ok(body && body.ok, '面板快照可读')
  ok(body.levels && body.levels.length === 5, '快照带 5 档等级')
  ok(body.diseases && body.diseases.length === 20, '快照带 20 个病种')

  // 面板动作：care
  const actRoute = webRoutes.find((r) => r.path === '/dsh-sick-fatfish/panel/action')
  let body2 = null
  const mkReq = (obj) => {
    const chunks = [Buffer.from(JSON.stringify(obj))]
    const h = {}
    return {
      method: 'POST',
      on(evt, fn) {
        if (evt === 'data') chunks.forEach((c) => fn(c))
        if (evt === 'end') fn()
      },
    }
  }
  await actRoute.handler(mkReq({ action: 'roll', level: 2, sid: 'session-test-1' }), { statusCode: 0, setHeader() {}, end(s) { body2 = JSON.parse(s) } })
  ok(body2 && body2.ok && body2.session.count === 2, '面板 roll 到 Lv2')

  // 关 + 事件结算
  const offTool = tools.find((t) => t.name === 'sick_off')
  await offTool.execute({}, exec)
  listeners['session/event']?.forEach((fn) => fn(fakeAgent.session, { type: 'message/user' }))
  listeners['session/event']?.forEach((fn) => fn(fakeAgent.session, { type: 'turn/end' }))
  ok(true, '事件开关不炸')

  // dispose
  for (const fn of effects) {
    try {
      fn()
    } catch {}
  }
  rmSync(home, { recursive: true, force: true })
}

/* ---------------------------- 10. 静态契约 --------------------------- */
{
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  eq(pkg.name, 'dsh-sick-fatfish', 'package name')
  eq(pkg.main, './src/index.js', 'package main')
  ok(pkg.dsh?.bundle?.patch === './cordis.patch.yml', 'bundle patch 指向')
  ok(pkg.exports?.['./client'] === './client.js', 'client 导出')

  const patch = readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
  ok(patch.includes('id: dsh-sick-fatfish'), 'patch id 与包名一致')

  const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  ok(client.includes("id: 'dsh-sick-fatfish'"), 'client __ModuleLoader__ id 与包名一致')
  ok(client.includes('sidebar.panellist'), 'client 注册侧栏')
  ok(client.includes('settings.section') === false, 'client 不硬塞设置页（面板走侧栏）')

  const engineSrc = readFileSync(new URL('../src/engine.js', import.meta.url), 'utf8')
  ok(!engineSrc.includes('diseasе'), '没有西里尔字母伪装标识符')
  ok(DEFAULTS.careDailyCap === 8, '默认每日上限 8')
  ok(DEFAULTS.careChronicAt === 12, '默认慢性门槛 12')
  ok(DEFAULTS.chronicFloor === 6, '默认慢性地板 6')
}

/* ------------------------------ 汇总 ------------------------------ */
console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
