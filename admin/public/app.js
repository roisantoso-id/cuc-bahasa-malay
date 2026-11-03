// JomBelajar 5000 高频词后台前端:原生 JS 单页,路由 #/overview #/words #/students #/teachers
const $ = s => document.querySelector(s)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
let ME = null

async function api(path, opts = {}) {
  const r = await fetch('/api/admin' + path, { method: opts.method || 'GET', headers: opts.body ? { 'content-type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && path !== '/login') { showLogin(); throw new Error('请先登录') }
  if (!r.ok) throw new Error(d.error || `出错了(${r.status})`)
  return d
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true }, 2600) }
const fail = e => toast(e.message || '操作失败')
const stopName = l => { const s = ME.stops.find(x => x.level === Number(l)); return s ? `第 ${s.level} 站 · ${s.city}` : `第 ${l} 级` }
const time = s => (s ? new Date(s).toLocaleString('zh-CN', { hour12: false }).replace(/:\d\d$/, '') : '')

// ---------- 登录 ----------
function showLogin() { $('#app').hidden = true; $('#login').hidden = false }
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault()
  const f = new FormData(e.target)
  $('#loginErr').textContent = ''
  try { await api('/login', { method: 'POST', body: { user: f.get('user'), password: f.get('password') } }); boot() } catch (err) { $('#loginErr').textContent = err.message }
})
$('#logout').addEventListener('click', async () => { await api('/logout', { method: 'POST' }).catch(() => {}); showLogin() })

async function boot() {
  try { ME = await api('/me') } catch { return }
  $('#login').hidden = true
  $('#app').hidden = false
  $('#modeTag').textContent = ME.demo ? '演示模式' : '正式'
  route()
}

// ---------- 弹窗 ----------
function dialog(html, onSubmit, { wide = false } = {}) {
  const dlg = $('#dlg'), form = $('#dlgForm')
  dlg.classList.toggle('wide', wide)
  form.innerHTML = html + '<p class="err" id="dlgErr"></p><div class="dlg-ops"><button class="btn" value="cancel" formnovalidate>取消</button><button class="btn primary" value="ok" id="dlgOk">保存</button></div>'
  form.onsubmit = async e => {
    if (e.submitter && e.submitter.value === 'cancel') return
    e.preventDefault()
    $('#dlgOk').disabled = true
    try { await onSubmit(new FormData(form), form); dlg.close() } catch (err) { $('#dlgErr').textContent = err.message } finally { const b = $('#dlgOk'); if (b) b.disabled = false }
  }
  dlg.showModal()
  return form
}
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`

// ---------- 概览 ----------
async function viewOverview() {
  const o = await api('/overview')
  const by = {}
  for (const r of o.words) (by[r.level] ||= { approved: 0, pending: 0 })[r.status] = r.n
  const sum = k => Object.values(by).reduce((n, x) => n + (x[k] || 0), 0)
  $('#view').innerHTML = `<h1>概览</h1>
    <div class="stats">
      <div class="stat"><b>${sum('approved')}</b><span class="muted">已上架单词</span></div>
      <div class="stat"><b>${sum('pending')}</b><span class="muted">待补释义</span></div>
      <div class="stat"><b>${o.check}</b><span class="muted">含待复核义项的词</span></div>
      <div class="stat"><b>${o.students}</b><span class="muted">注册学生</span></div>
      <div class="stat"><b>${o.activeToday}</b><span class="muted">今天学习人数</span></div>
      <div class="stat"><b>${o.active7}</b><span class="muted">近 7 天学习人数</span></div>
      <div class="stat"><b>${o.learnedToday}</b><span class="muted">今天新学词次</span></div>
      <div class="stat"><b>${o.reviewedToday}</b><span class="muted">今天复习词次</span></div>
    </div>
    <div class="bar"><h1 class="grow" style="margin:0;font-size:16px">10 站词表</h1><button class="btn" id="imp">导入词库（words.json）</button></div>
    <div class="card scroll"><table class="tbl levels"><thead><tr><th>站</th><th>词序</th><th class="num">已上架</th><th class="num">待补</th><th>进度</th><th></th></tr></thead><tbody>
    ${ME.stops.map(s => { const x = by[s.level] || {}; const a = x.approved || 0, p = x.pending || 0
      return `<tr><td class="ms">${esc(stopName(s.level))}</td><td class="muted">${(s.level - 1) * 500 + 1}–${s.level * 500}</td><td class="num">${a}</td><td class="num">${p}</td>
      <td><div class="meter"><i style="width:${a + p ? a / (a + p) * 100 : 0}%"></i></div></td><td class="ops"><a href="#/words?level=${s.level}">查看</a></td></tr>` }).join('')}
    </tbody></table></div>
    <p class="muted">小程序里每站显示「已上架」的词。待补的词等启航给出释义和例句，用 <code>content/vocab5000/build.py</code> 生成 words.json 后在这里导入。</p>`
  $('#imp').onclick = importDialog
}

function importDialog() {
  dialog(`<h2>导入词库</h2>
    <p class="muted">选 <code>content/vocab5000/words.json</code>（build.py 生成）。按词序更新；后台手动改过的词默认保留不覆盖。</p>
    <label>文件<input type="file" name="f" accept=".json,application/json" required></label>
    <label style="font-weight:400;display:flex;gap:6px;align-items:center"><input type="checkbox" name="ow" style="width:auto"> 覆盖后台改过的词</label>`, async fd => {
    const f = fd.get('f')
    let words
    try { words = JSON.parse(await f.text()) } catch { throw new Error('不是有效的 JSON 文件') }
    const r = await api('/words/import', { method: 'POST', body: { words, overwriteEdited: !!fd.get('ow') } })
    toast(`导入完成：${r.total} 条，更新 ${r.changed} 条`)
    route()
  })
}

// ---------- 单词 ----------
const W = { level: '', status: '', q: '', page: 0 }
async function viewWords(params) {
  if (params.has('level')) Object.assign(W, { level: params.get('level'), page: 0 })
  const qs = new URLSearchParams({ level: W.level, status: W.status, q: W.q, page: W.page })
  const d = await api('/words?' + qs)
  const pages = Math.ceil(d.total / 100)
  $('#view').innerHTML = `<h1>单词</h1>
    <div class="bar">
      <select id="fLevel">${opt('', '全部站点', W.level)}${ME.stops.map(s => opt(s.level, stopName(s.level), W.level)).join('')}</select>
      <select id="fStatus">${opt('', '全部状态', W.status)}${opt('approved', '已上架', W.status)}${opt('pending', '待补 / 下架', W.status)}${opt('check', '含待复核义项', W.status)}</select>
      <input id="fQ" placeholder="搜马来语、中文或词序" value="${esc(W.q)}">
      <span class="count grow">共 ${d.total} 个</span>
    </div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>词序</th><th>马来语</th><th>释义</th><th class="hide-m">发音</th><th>状态</th><th></th></tr></thead><tbody>
    ${d.words.map(w => `<tr><td class="muted">${w.rank}</td><td class="ms">${esc(w.ms)}${w.root ? `<div class="muted" style="font-weight:400">词根 ${esc(w.root)}</div>` : ''}</td>
      <td class="zh-list">${w.senses.map(s => `<div>${s.check ? '<span class="tag draft">待复核</span> ' : ''}<span class="muted">${esc(s.pos)}</span> ${esc(s.zh)}</div>`).join('') || '<span class="muted">还没有释义</span>'}</td>
      <td class="hide-m">${w.audioUrl ? `<button class="btn sm" data-play="${esc(w.audioUrl)}">▶</button>` : '<span class="muted">无</span>'}</td>
      <td><span class="tag ${w.status === 'approved' ? 'ok' : 'draft'}">${w.status === 'approved' ? '已上架' : '待补'}</span>${w.edited ? ' <span class="tag">改过</span>' : ''}</td>
      <td class="ops"><button class="btn sm" data-edit="${w.rank}">编辑</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">没有符合条件的词</td></tr>'}
    </tbody></table>
    ${pages > 1 ? `<div class="pager"><button class="btn sm" id="prev" ${W.page ? '' : 'disabled'}>上一页</button><span class="count">${W.page + 1} / ${pages}</span><button class="btn sm" id="next" ${W.page + 1 < pages ? '' : 'disabled'}>下一页</button></div>` : ''}</div>`
  const re = () => { W.page = 0; location.hash === '#/words' ? route() : (location.hash = '#/words') }
  $('#fLevel').onchange = e => { W.level = e.target.value; re() }
  $('#fStatus').onchange = e => { W.status = e.target.value; re() }
  $('#fQ').onkeydown = e => { if (e.key === 'Enter') { W.q = e.target.value.trim(); re() } }
  if ($('#prev')) { $('#prev').onclick = () => { W.page--; route() }; $('#next').onclick = () => { W.page++; route() } }
  const player = new Audio()
  $('#view').querySelectorAll('[data-play]').forEach(b => { b.onclick = () => { player.src = b.dataset.play; player.play().catch(() => toast('音频播放失败（检查 COS 地址）')) } })
  $('#view').querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editWord(d.words.find(w => w.rank === Number(b.dataset.edit))) })
}

function senseRow(s = {}) {
  return `<div class="sense-row${s.check ? ' check' : ''}">
    <div class="sense-ops"><label><input type="checkbox" data-k="check"${s.check ? ' checked' : ''}> 待复核（学生看不到）</label><button type="button" class="btn sm danger" data-rm>删除</button></div>
    <div class="row2" style="margin-top:22px"><label>词性<input data-k="pos" value="${esc(s.pos)}" maxlength="20"></label><label>中文释义<input data-k="zh" value="${esc(s.zh)}" maxlength="200"></label></div>
    <label>马来语例句<input data-k="exMs" value="${esc(s.exMs)}" maxlength="400"></label>
    <label>例句翻译<input data-k="exZh" value="${esc(s.exZh)}" maxlength="400"></label></div>`
}
function editWord(w) {
  const form = dialog(`<h2>No.${w.rank} · ${esc(stopName(w.level))}</h2>
    <div class="row2"><label>马来语<input name="ms" value="${esc(w.ms)}" required maxlength="80"></label><label>词根<input name="root" value="${esc(w.root)}" maxlength="80"></label></div>
    <label>状态<select name="status">${opt('approved', '已上架（小程序可学）', w.status)}${opt('pending', '待补 / 下架', w.status)}</select></label>
    ${w.audioUrl ? `<p><audio controls preload="none" src="${esc(w.audioUrl)}"></audio> <span class="muted">${esc(w.audio)}</span></p>` : ''}
    <div class="senses-ed" id="senses">${w.senses.map(senseRow).join('')}</div>
    <button type="button" class="btn sm" id="addSense">加一条义项</button>`, async fd => {
    const senses = [...form.querySelectorAll('.sense-row')].map(r => { const o = {}; r.querySelectorAll('[data-k]').forEach(i => { o[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value }); return o })
    await api('/words/' + w.rank, { method: 'PUT', body: { ms: fd.get('ms'), root: fd.get('root'), status: fd.get('status'), senses } })
    toast('已保存')
    route()
  }, { wide: true })
  const box = form.querySelector('#senses')
  const bind = () => box.querySelectorAll('[data-rm]').forEach(b => { b.onclick = () => b.closest('.sense-row').remove() })
  form.querySelector('#addSense').onclick = () => { box.insertAdjacentHTML('beforeend', senseRow()); bind() }
  box.onchange = e => { if (e.target.dataset.k === 'check') e.target.closest('.sense-row').classList.toggle('check', e.target.checked) }
  bind()
}

// ---------- 学生 ----------
async function viewStudents() {
  const list = await api('/students')
  const schools = [...new Set(list.map(s => s.school).filter(Boolean))]
  $('#view').innerHTML = `<h1>学生</h1>
    <div class="bar"><select id="fSchool">${opt('', '全部学校', '')}${schools.map(s => opt(s, s, '')).join('')}</select><input id="fName" placeholder="搜姓名、班级、手机号"><span class="count grow" id="cnt"></span><a class="btn" href="/api/admin/students.csv">导出 CSV</a></div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>姓名</th><th>学校 / 班级</th><th class="hide-m">起点</th><th class="hide-m">手机号</th><th>已学</th><th>已掌握</th><th class="hide-m">学习天数</th><th>最近活跃</th></tr></thead><tbody id="rows"></tbody></table></div>`
  const draw = () => {
    const sc = $('#fSchool').value, k = $('#fName').value.trim()
    const rows = list.filter(s => (!sc || s.school === sc) && (!k || [s.name, s.className, s.phone].some(v => String(v || '').includes(k))))
    $('#cnt').textContent = `共 ${rows.length} 人`
    $('#rows').innerHTML = rows.map(s => `<tr><td class="ms">${esc(s.name)}</td><td>${esc(s.school)}<div class="muted">${esc(s.className)}</div></td><td class="hide-m">${s.track === 'some' ? '会说一些' : '零基础'}</td><td class="hide-m">${esc(s.phone)}</td>
      <td>${s.learned}</td><td>${s.mastered}</td><td class="hide-m">${s.days}</td><td class="muted">${esc(time(s.lastActiveAt))}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">还没有学生注册</td></tr>'
  }
  $('#fSchool').onchange = draw
  $('#fName').oninput = draw
  draw()
}

// ---------- 老师 ----------
async function viewTeachers() {
  const list = await api('/teachers')
  $('#view').innerHTML = `<h1>老师</h1>
    <div class="bar"><span class="count grow">小程序「关于老师」页按排序显示，第一位是课程主持。</span><button class="btn primary" id="add">添加</button></div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>排序</th><th>照片</th><th>姓名</th><th class="hide-m">身份</th><th></th></tr></thead><tbody>
    ${list.map(t => `<tr><td>${t.sort}</td><td>${t.photo ? `<img class="thumb" src="${esc(t.photo)}" alt="">` : '<span class="muted">用默认</span>'}</td><td class="ms">${esc(t.name)}<div class="muted" style="font-weight:400">${esc(t.role)}</div></td><td class="hide-m">${esc(t.title)}</td>
      <td class="ops"><button class="btn sm" data-edit="${t.id}">编辑</button> <button class="btn sm danger" data-del="${t.id}">删除</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">还没有老师信息</td></tr>'}
    </tbody></table></div>`
  $('#add').onclick = () => editTeacher({ sort: list.length + 1 })
  $('#view').querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editTeacher(list.find(t => t.id === Number(b.dataset.edit))) })
  $('#view').querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { if (!confirm('删除这位老师的信息？')) return; await api('/teachers/' + b.dataset.del, { method: 'DELETE' }).catch(fail); route() } })
}
function editTeacher(t) {
  dialog(`<h2>${t.id ? '编辑' : '添加'}老师</h2>
    <div class="row2"><label>姓名<input name="name" value="${esc(t.name)}" required maxlength="30"></label><label>排序<input name="sort" type="number" value="${esc(t.sort)}"></label></div>
    <div class="row2"><label>角色<input name="role" value="${esc(t.role)}" maxlength="30" placeholder="例如：课程主持"></label><label>身份<input name="title" value="${esc(t.title)}" maxlength="100"></label></div>
    <label>介绍<textarea name="bio" maxlength="1000">${esc(t.bio)}</textarea></label>
    <label>照片（jpg / png，5MB 以内；不传就用小程序自带的）<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>`, async fd => {
    const f = fd.get('photo')
    if (f && f.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5MB')
    const photoData = f && f.size ? await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f) }) : ''
    const body = { name: fd.get('name'), sort: fd.get('sort'), role: fd.get('role'), title: fd.get('title'), bio: fd.get('bio'), photo: t.photo || '', photoData }
    await api('/teachers' + (t.id ? '/' + t.id : ''), { method: t.id ? 'PUT' : 'POST', body })
    toast('已保存')
    route()
  })
}

// ---------- 路由 ----------
const VIEWS = { overview: viewOverview, words: viewWords, students: viewStudents, teachers: viewTeachers }
async function route() {
  const [name, query] = (location.hash.replace(/^#\//, '') || 'overview').split('?')
  const key = VIEWS[name] ? name : 'overview'
  document.querySelectorAll('.side nav a').forEach(a => a.classList.toggle('on', a.dataset.r === key))
  $('#view').innerHTML = '<p class="muted">加载中…</p>'
  try { await VIEWS[key](new URLSearchParams(query || '')) } catch (e) { $('#view').innerHTML = `<p class="err">${esc(e.message)}</p>` }
}
window.addEventListener('hashchange', route)
api('/me').then(() => boot()).catch(() => {})
