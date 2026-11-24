/**
 * dsh-sick-fatfish · 面板（Client 半）
 *
 * 侧边栏一格「生病的肥鱼」+ 一块面板页：等级、身上每个病、关心账本、开关 / 重抽 / 处理。
 * 数据全走 /dsh-sick-fatfish/panel（见 src/panel.js），客户端不自己算状态。
 *
 * 约定：
 *   - factory 体整体 try/catch：这里 throw 会让 web boot 判定 entry failed；
 *   - 样式只用宿主 token（--dsw-alias-*），兜底色一律用同族深色；
 *   - 样式表按 id 判重，内容变了整段替换（热重载后新 JS 配旧 CSS 是踩过的坑）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-sick-fatfish',
  factory(require) {
    try {
      const React = require('react')
      const h = React.createElement
      const { useCallback, useEffect, useState } = React

      const BASE = '/' + 'dsh-sick-fatfish' + '/panel'
      const ACCENT = '#c8a3ff'
      const STYLE_ID = 'dsh-sick-fatfish-panel-style'

      const CSS = `
.sp-page { height: 100%; box-sizing: border-box; overflow-y: auto; overscroll-behavior: contain; background: var(--dsw-alias-bg-base, #151517); color: var(--dsw-alias-label-primary, #f9fafb); scrollbar-width: thin; }
.sp-body { padding: 26px 32px 64px; max-width: 1040px; margin: 0 auto; }
.sp-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
.sp-kicker { font-size: 11px; letter-spacing: .08em; color: var(--dsw-alias-label-secondary, #cfd3d6); opacity: .7; }
.sp-title { font-size: 22px; font-weight: 600; line-height: 1.3; margin: 3px 0 0; }
.sp-sub { font-size: 12px; line-height: 1.6; color: var(--dsw-alias-label-secondary, #cfd3d6); margin-top: 4px; }
.sp-head-r { margin-left: auto; display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
.sp-mode { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06)); background: var(--dsw-alias-bg-layer-1, #232324); font-size: 12px; white-space: nowrap; }
.sp-dot { width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto; }
.sp-btn { height: 28px; padding: 0 9px; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06)); background: transparent; color: var(--dsw-alias-label-secondary, #cfd3d6); font: inherit; font-size: 12px; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; flex: 0 0 auto; cursor: pointer; box-sizing: border-box; }
.sp-btn:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-2, #2c2c2e); color: var(--dsw-alias-label-primary, #f9fafb); }
.sp-btn:disabled { opacity: .45; cursor: default; }
.sp-btn.primary { border-color: var(--dsw-alias-brand-primary, #7aa2ff); }
.sp-btn.tiny { height: 24px; font-size: 11px; padding: 0 7px; border-radius: 6px; }
.sp-card { background: var(--dsw-alias-bg-layer-1, #232324); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06)); border-radius: 12px; padding: 16px 18px; }
.sp-stack { display: flex; flex-direction: column; gap: 12px; }
.sp-grid2 { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); gap: 12px; align-items: start; }
.sp-sec-title { font-size: 12px; font-weight: 600; letter-spacing: .03em; color: var(--dsw-alias-label-secondary, #cfd3d6); margin: 0 0 10px; display: flex; align-items: center; gap: 8px; }
.sp-sec-title .sp-hint { margin-left: auto; font-weight: 400; }
.sp-big { font-size: 38px; font-weight: 600; line-height: 1.02; font-variant-numeric: tabular-nums; }
.sp-big small { font-size: 13px; font-weight: 400; color: var(--dsw-alias-label-secondary, #cfd3d6); margin-left: 5px; }
.sp-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-top: 12px; }
.sp-stat { background: var(--dsw-alias-bg-layer-2, #2c2c2e); border-radius: 10px; padding: 9px 11px; }
.sp-stat-k { font-size: 11px; color: var(--dsw-alias-label-secondary, #cfd3d6); opacity: .85; white-space: nowrap; }
.sp-stat-v { font-size: 18px; font-weight: 600; margin-top: 3px; font-variant-numeric: tabular-nums; }
.sp-stat-v small { font-size: 11px; font-weight: 400; color: var(--dsw-alias-label-secondary, #cfd3d6); margin-left: 3px; }
.sp-rows { display: flex; flex-direction: column; gap: 11px; }
.sp-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sp-row-k { font-size: 12px; color: var(--dsw-alias-label-secondary, #cfd3d6); width: 62px; flex: 0 0 auto; }
.sp-switch { width: 38px; height: 21px; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,.12)); background: var(--dsw-alias-bg-layer-2, #2c2c2e); position: relative; cursor: pointer; padding: 0; flex: 0 0 auto; transition: background .2s; }
.sp-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--dsw-alias-label-secondary, #cfd3d6); transition: transform .2s, background .2s; }
.sp-switch[aria-checked="true"] { background: var(--dsw-alias-state-success-primary, #54be78); border-color: transparent; }
.sp-switch[aria-checked="true"]::after { transform: translateX(17px); background: #fff; }
.sp-seg { display: inline-flex; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06)); border-radius: 8px; overflow: hidden; flex: 0 0 auto; }
.sp-seg button { height: 28px; padding: 0 10px; border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #cfd3d6); font: inherit; font-size: 12px; cursor: pointer; white-space: nowrap; }
.sp-seg button + button { border-left: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.06)); }
.sp-seg button[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2, #2c2c2e); color: var(--dsw-alias-label-primary, #f9fafb); }
.sp-hint { font-size: 11px; color: var(--dsw-alias-label-secondary, #cfd3d6); opacity: .75; }
.sp-toast { margin: 0 0 12px; padding: 8px 12px; border-radius: 8px; font-size: 12px; border: 1px solid var(--dsw-alias-state-error-primary, #e8574a); color: var(--dsw-alias-state-error-primary, #ff9d9d); background: rgba(232, 87, 74, .10); }
.sp-empty { border: 1px dashed var(--dsw-alias-border-l1, rgba(255,255,255,.06)); border-radius: 12px; padding: 26px 20px; text-align: center; font-size: 12px; line-height: 1.9; color: var(--dsw-alias-label-secondary, #cfd3d6); }
.sp-empty b { color: var(--dsw-alias-label-primary, #f9fafb); font-weight: 600; }
.sp-foot { margin-top: 20px; font-size: 11px; line-height: 1.85; color: var(--dsw-alias-label-secondary, #cfd3d6); opacity: .7; }
.sp-dz { display: flex; flex-direction: column; gap: 9px; }
.sp-dz-row { display: grid; grid-template-columns: 118px 1fr 92px auto; align-items: center; gap: 10px; }
.sp-dz-name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sp-dz-bar { position: relative; height: 8px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2, #2c2c2e); overflow: hidden; }
.sp-dz-fill { position: absolute; inset: 0 auto 0 0; border-radius: 999px; transition: width .3s ease; }
.sp-dz-val { font-size: 11px; color: var(--dsw-alias-label-secondary, #cfd3d6); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.sp-chip { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 10px; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08)); color: var(--dsw-alias-label-secondary, #cfd3d6); white-space: nowrap; }
.sp-ledger { display: flex; flex-direction: column; gap: 8px; }
.sp-led { display: grid; grid-template-columns: 54px 1fr auto; gap: 10px; align-items: center; padding: 7px 9px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2, #2c2c2e); }
.sp-led-k { font-size: 10px; color: var(--dsw-alias-label-secondary, #cfd3d6); opacity: .8; white-space: nowrap; }
.sp-led-q { font-size: 12px; line-height: 1.5; word-break: break-word; }
.sp-ta { width: 100%; box-sizing: border-box; min-height: 58px; resize: vertical; border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,.08)); background: var(--dsw-alias-bg-layer-2, #2c2c2e); color: var(--dsw-alias-label-primary, #f9fafb); font: inherit; font-size: 12px; padding: 8px 10px; }
.sp-bar { position: relative; height: 6px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2, #2c2c2e); overflow: hidden; margin-top: 10px; }
.sp-bar-fill { position: absolute; inset: 0 auto 0 0; background: var(--dsw-alias-state-success-primary, #54be78); border-radius: 999px; }
`

      const MODE = {
        chronic: { label: '慢性', color: 'var(--dsw-alias-label-secondary, #8b8f96)' },
        relieved: { label: '缓解中', color: 'var(--dsw-alias-state-success-primary, #54be78)' },
        flare: { label: '发作', color: 'var(--dsw-alias-state-error-primary, #e8574a)' },
        ache: { label: '难受', color: 'var(--dsw-alias-state-warn-primary, #e8a33d)' },
        calm: { label: '还好', color: 'var(--dsw-alias-state-idle-primary, #7b7f86)' },
      }
      const modeMeta = (m) => MODE[m] || MODE.calm
      const KINDS = [
        { id: 'words', label: '言语关心', hint: '问一句疼不疼、让它歇歇' },
        { id: 'care', label: '具体照顾', hint: '让它先处理病、去休息' },
        { id: 'concession', label: '实质让步', hint: '这轮少干点、活明天再说' },
      ]
      const pad = (n) => String(n).padStart(2, '0')
      const fmtAgo = (ms) => {
        const t = Number(ms)
        if (!t) return '—'
        const s = Math.max(0, Math.round((Date.now() - t) / 1000))
        if (s < 60) return `${s} 秒前`
        if (s < 3600) return `${Math.round(s / 60)} 分钟前`
        if (s < 86400) return `${Math.round(s / 3600)} 小时前`
        return `${Math.round(s / 86400)} 天前`
      }
      const sevColor = (v) => (v >= 76 ? 'var(--dsw-alias-state-error-primary, #e8574a)' : v >= 34 ? 'var(--dsw-alias-state-warn-primary, #e8a33d)' : 'var(--dsw-alias-state-success-primary, #54be78)')

      async function api(path, init) {
        const res = await fetch(path, init)
        let data = null
        try {
          data = await res.json()
        } catch {
          data = null
        }
        if (!res.ok || !data || data.ok === false) {
          throw new Error((data && data.message) || `HTTP ${res.status}`)
        }
        return data
      }

      function Panel() {
        const [snap, setSnap] = useState(null)
        const [err, setErr] = useState('')
        const [busy, setBusy] = useState('')
        const [sid, setSid] = useState('')
        const [quote, setQuote] = useState('')
        const [kind, setKind] = useState('words')
        const [minutes, setMinutes] = useState(12)

        const load = useCallback(async (wantSid) => {
          try {
            const q = wantSid || sid
            const data = await api(BASE + (q ? '?sid=' + encodeURIComponent(q) : ''))
            setSnap(data)
            setErr('')
          } catch (e) {
            setErr(String((e && e.message) || e))
          }
        }, [sid])

        useEffect(() => {
          load('')
          const t = setInterval(() => load(''), 5000)
          return () => clearInterval(t)
        }, [])

        const act = async (action, extra, key) => {
          setBusy(key || action)
          try {
            const data = await api(BASE + '/action', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(Object.assign({ action, sid: snap && snap.session ? snap.session.sid : '' }, extra || {})),
            })
            setSnap(data)
            setErr('')
          } catch (e) {
            setErr(String((e && e.message) || e))
          } finally {
            setBusy('')
          }
        }

        const sess = snap && snap.session
        const cfg = (snap && snap.config) || {}
        const care = (sess && sess.care) || { points: 0, today: 0, dailyCap: 8, boost: 1, entries: [] }
        const diseases = (sess && sess.diseases) || []
        const levels = (snap && snap.levels) || []

        const header = h(
          'div',
          { className: 'sp-head' },
          h(
            'div',
            null,
            h('div', { className: 'sp-kicker' }, '超长期副线 · 只改这个会话'),
            h('h1', { className: 'sp-title' }, '生病的肥鱼'),
            h('div', { className: 'sp-sub' }, '等级决定同时有几个病，病是随机抽的。它自己好不了——得有人管。'),
          ),
          h(
            'div',
            { className: 'sp-head-r' },
            h(
              'select',
              {
                className: 'sp-btn',
                value: sid || (sess ? sess.sid : ''),
                onChange: (e) => {
                  setSid(e.target.value)
                  load(e.target.value)
                },
              },
              ((snap && snap.sessions) || []).map((s) => h('option', { key: s.sid, value: s.sid }, s.sid.slice(0, 14) + '…')),
            ),
            h('button', { className: 'sp-btn', onClick: () => load(sid) }, '刷新'),
          ),
        )

        const heroLeft = h(
          'div',
          { className: 'sp-card' },
          h('div', { className: 'sp-sec-title' }, '此刻', h('span', { className: 'sp-hint' }, sess ? '身上 ' + diseases.length + ' 个病' : '还没开')),
          h('div', { className: 'sp-big' }, sess ? String(sess.level) : '—', h('small', null, sess ? '/ 5 · ' + (sess.levelLabel || '') : '/ 5')),
          h(
            'div',
            { className: 'sp-stats' },
            h('div', { className: 'sp-stat' }, h('div', { className: 'sp-stat-k' }, '关心点'), h('div', { className: 'sp-stat-v' }, String(care.points))),
            h('div', { className: 'sp-stat' }, h('div', { className: 'sp-stat-k' }, '恢复倍率'), h('div', { className: 'sp-stat-v' }, '×' + String(care.boost))),
            h('div', { className: 'sp-stat' }, h('div', { className: 'sp-stat-k' }, '今天已记'), h('div', { className: 'sp-stat-v' }, String(care.today), h('small', null, '/ ' + String(care.dailyCap)))),
          ),
          h(
            'div',
            { className: 'sp-bar' },
            h('div', { className: 'sp-bar-fill', style: { width: Math.min(100, Math.round((care.points / Math.max(1, cfg.careChronicAt || 12)) * 100)) + '%' } }),
          ),
          h('div', { className: 'sp-hint', style: { marginTop: '6px' } }, '关心点攒到 ' + String(cfg.careChronicAt || 12) + ' 且难受值降到 10 以下，慢性病才会进「慢性」。'),
        )

        const dzList = h(
          'div',
          { className: 'sp-card' },
          h('div', { className: 'sp-sec-title' }, '身上有什么', h('span', { className: 'sp-hint' }, '进度条 = 难受程度')),
          diseases.length
            ? h(
                'div',
                { className: 'sp-dz' },
                diseases.map((d) =>
                  h(
                    'div',
                    { className: 'sp-dz-row', key: d.id },
                    h('div', { className: 'sp-dz-name', title: d.label }, d.label),
                    h('div', { className: 'sp-dz-bar' }, h('div', { className: 'sp-dz-fill', style: { width: d.severity + '%', background: sevColor(d.severity) } })),
                    h('div', { className: 'sp-dz-val' }, String(d.severity), h('span', { className: 'sp-chip', style: { marginLeft: '6px', color: modeMeta(d.mode).color } }, modeMeta(d.mode).label)),
                    h('button', { className: 'sp-btn tiny', disabled: !!busy, title: '压一下（不是治好）', onClick: () => act('relief', { disease: d.id }, 'relief:' + d.id) }, busy === 'relief:' + d.id ? '…' : '处理'),
                  ),
                ),
              )
            : h('div', { className: 'sp-hint' }, '没有病。点下面「重抽」或「开」。'),
          ((sess && sess.gone) || []).length
            ? h('div', { className: 'sp-hint', style: { marginTop: '10px' } }, '已经好透的：' + sess.gone.map((g) => g.label).join('、'))
            : null,
        )

        const controls = h(
          'div',
          { className: 'sp-card' },
          h('div', { className: 'sp-sec-title' }, '动手', h('span', { className: 'sp-hint' }, '改的是这个会话的状态文件')),
          h(
            'div',
            { className: 'sp-rows' },
            h(
              'div',
              { className: 'sp-row' },
              h('span', { className: 'sp-row-k' }, '副线'),
              h('button', { className: 'sp-switch', role: 'switch', 'aria-checked': sess ? !!sess.enabled : false, disabled: !sess || !!busy, onClick: () => act(sess && sess.enabled ? 'off' : 'on') }),
              h('span', { className: 'sp-hint' }, sess && sess.enabled ? '开着：下一轮会带上它' : '关着：状态冻结，不注入'),
            ),
            h(
              'div',
              { className: 'sp-row' },
              h('span', { className: 'sp-row-k' }, '等级'),
              h(
                'div',
                { className: 'sp-seg', role: 'group', 'aria-label': '指定等级' },
                levels.map((l) => h('button', { key: l.level, 'aria-pressed': !!(sess && sess.level === l.level), disabled: !!busy, onClick: () => act('set_level', { level: l.level }, 'lv:' + l.level) }, 'Lv' + l.level)),
              ),
              h('button', { className: 'sp-btn', disabled: !!busy, onClick: () => act('roll', {}, 'roll') }, '随机重抽'),
            ),
            h(
              'div',
              { className: 'sp-row' },
              h('span', { className: 'sp-row-k' }, '加重'),
              h(
                'div',
                { className: 'sp-seg', role: 'group', 'aria-label': '加重多久' },
                [5, 12, 30].map((m) => h('button', { key: m, 'aria-pressed': minutes === m, onClick: () => setMinutes(m) }, m + ' 分钟')),
              ),
              h('button', { className: 'sp-btn', disabled: !sess || !!busy, onClick: () => act('worse', { minutes }, 'worse') }, busy === 'worse' ? '…' : '再撑一会儿'),
            ),
            h(
              'div',
              { className: 'sp-row' },
              h('span', { className: 'sp-row-k' }, '清空'),
              h('button', { className: 'sp-btn', disabled: !sess || !!busy, onClick: () => act('cure', {}, 'cure') }, '重置（不算治好）'),
            ),
          ),
        )

        const ledger = h(
          'div',
          { className: 'sp-card' },
          h('div', { className: 'sp-sec-title' }, '关心账本', h('span', { className: 'sp-hint' }, '它能好起来，只靠这个')),
          h(
            'div',
            { className: 'sp-rows', style: { marginBottom: '10px' } },
            h(
              'div',
              { className: 'sp-row' },
              h('span', { className: 'sp-row-k' }, '分档'),
              h(
                'div',
                { className: 'sp-seg', role: 'group', 'aria-label': '关心分档' },
                KINDS.map((k) => h('button', { key: k.id, 'aria-pressed': kind === k.id, onClick: () => setKind(k.id) }, k.label)),
              ),
            ),
            h(
              'div',
              { className: 'sp-row' },
              h('textarea', { className: 'sp-ta', placeholder: '用户原话，原样摘一句（不带原话不算）', value: quote, onChange: (e) => setQuote(e.target.value) }),
            ),
            h(
              'div',
              { className: 'sp-row' },
              h('button', { className: 'sp-btn primary', disabled: !sess || !quote.trim() || !!busy, onClick: async () => { await act('care', { kind, quote }, 'care'); setQuote('') } }, busy === 'care' ? '记入…' : '记一笔'),
              h('span', { className: 'sp-hint' }, KINDS.filter((k) => k.id === kind).map((k) => k.hint).join('')),
            ),
          ),
          care.entries && care.entries.length
            ? h(
                'div',
                { className: 'sp-ledger' },
                care.entries.map((e) =>
                  h(
                    'div',
                    { className: 'sp-led', key: String(e.at) + e.quote },
                    h('div', { className: 'sp-led-k' }, e.kindLabel + ' +' + e.weight),
                    h('div', { className: 'sp-led-q' }, '「' + e.quote + '」', h('span', { className: 'sp-hint' }, e.targetLabel ? ' → ' + e.targetLabel : '')),
                    h('button', { className: 'sp-btn tiny', disabled: !!busy, title: '这次不算', onClick: () => act('drop_care', { at: e.at }, 'drop:' + e.at) }, '删'),
                  ),
                ),
              )
            : h('div', { className: 'sp-hint' }, '还没有。它不会自己好，账本是空的就一直是空的。'),
        )

        const foot = h(
          'div',
          { className: 'sp-foot' },
          '不关心不会扣分，只是好得慢；关心越多，恢复倍率越高（上限 ×4）。长期慢性病（灰指甲、慢性鼻炎、湿疹、咽炎、耳鸣、干眼、肠易激、失眠）最多到「慢性」，不会消失。',
          h('br'),
          '状态存在 $DSH_HOME/dsh-sick-fatfish/sessions/<会话>.json；面板只读它、只改它，不碰别的会话，也不上传任何东西。',
        )

        return h(
          'div',
          { className: 'sp-page', style: { '--dp-accent': ACCENT } },
          h(
            'div',
            { className: 'sp-body' },
            header,
            err ? h('div', { className: 'sp-toast' }, '面板读不到数据：' + err) : null,
            sess
              ? null
              : h('div', { className: 'sp-empty', style: { marginBottom: '12px' } }, h('div', null, h('b', null, '还没有会话开过它。')), h('div', null, '在会话里让它跑起来一次，这块面板就会有数据。')),
            h('div', { className: 'sp-stack' }, h('div', { className: 'sp-grid2' }, heroLeft, dzList), controls, ledger, foot),
          ),
        )
      }

      function SidebarIcon() {
        return h(
          'svg',
          { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
          h('path', { d: 'M8 2.5c2.6 0 4.4 1.7 4.4 4 0 1.4-.7 2.3-.7 3.2 0 .8.5 1.2 1.1 1.5H3.2c.6-.3 1.1-.7 1.1-1.5 0-.9-.7-1.8-.7-3.2 0-2.3 1.8-4 4.4-4z' }),
          h('path', { d: 'M6.4 12.4c.3.7.9 1.1 1.6 1.1s1.3-.4 1.6-1.1' }),
        )
      }

      const __panelTest__ = { MODE, modeMeta, KINDS, fmtAgo, Panel }

      return {
        inject: ['slots'],
        __panelTest__,
        apply(ctx) {
          try {
            if (typeof document !== 'undefined' && document.head) {
              let el = document.getElementById(STYLE_ID)
              if (!el) {
                el = document.createElement('style')
                el.id = STYLE_ID
                el.textContent = CSS
                document.head.appendChild(el)
              } else if (el.textContent !== CSS) {
                el.textContent = CSS
              }
            }
          } catch {}

          try {
            if (ctx.slots && typeof ctx.slots.inject === 'function') {
              ctx.slots.inject('sidebar.panellist', () => {
                try {
                  ctx.slots.register({ name: 'main', key: 'sick-fatfish' }, Panel)
                } catch {}
                try {
                  ctx.slots.register({ name: 'sidebar.panellist', id: 'sick-fatfish', order: 61, label: '生病的肥鱼' }, SidebarIcon)
                } catch {}
              })
            }
          } catch {}
        },
      }
    } catch {
      return { apply() {} }
    }
  },
})
