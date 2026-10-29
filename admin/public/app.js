// JomBelajar 背单词后台前端:原生 JS 单页,路由 #/scenes #/words #/teachers #/students
const $ = s => document.querySelector(s)
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const POS = ['名', '动', '形', '副', '代', '数', '介', '连', '叹', '短语', '方位', '其他']
let ME = null
let SCENES = []

async function api(path, opts = {}) {
  const r = await fetch('/api' + path, { method: opts.method || 'GET', headers: opts.body ? { 'content-type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && path !== '/login') { showLogin(); throw new Error('请先登录') }
  if (!r.ok) throw new Error(d.error || `出错了(${r.status})`)
  return d
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true }, 2600) }
const fail = e => toast(e.message || '操作失败')

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
  $('#modeTag').textContent = ME.demo ? '演示模式' : '云开发'
  route()
}

// ---------- 弹窗表单 ----------
function dialog(html, onSubmit) {
  const dlg = $('#dlg'), form = $('#dlgForm')
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

// 图片 / 音频地址(云存储 fileID 换临时链接)
async function urls(ids) { ids = [...new Set(ids.filter(Boolean))]; return ids.length ? api('/files/urls', { method: 'POST', body: { ids } }) : {} }
async function pickFile(input, folder) {
  const f = input.files[0]
  if (!f) return ''
  if (f.size > 5 * 1024 * 1024) throw new Error('图片不能超过 5MB')
  const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f) })
  return (await api('/upload', { method: 'POST', body: { name: f.name, data, folder } })).fileID
}

// ---------- 场景 ----------
async function viewScenes() {
  SCENES = await api('/scenes')
  const words = await api('/words')
  const count = id => words.filter(w => w.sceneId === id).length
  const approved = id => words.filter(w => w.sceneId === id && w.status === 'approved').length
  SCENES.sort((a, b) => a.order - b.order)
  $('#view').innerHTML = `<h1>场景</h1>
    <div class="bar"><span class="count grow">共 ${SCENES.length} 个场景。小程序只显示「已上架」的场景。</span><button class="btn primary" id="add">新建场景</button></div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>排序</th><th>场景</th><th class="hide-m">马来语</th><th>单词</th><th>状态</th><th></th></tr></thead><tbody>
    ${SCENES.map(s => `<tr><td>${s.order}</td><td class="ms">${esc(s.name)}</td><td class="hide-m">${esc(s.name_ms)}</td><td>${count(s._id)}<span class="muted">（已审核 ${approved(s._id)}）</span></td>
      <td><span class="tag ${s.published ? 'ok' : ''}">${s.published ? '已上架' : '未上架'}</span></td>
      <td class="ops"><button class="btn sm" data-pub="${s._id}">${s.published ? '下架' : '上架'}</button> <button class="btn sm" data-edit="${s._id}">编辑</button> <button class="btn sm danger" data-del="${s._id}">删除</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">还没有场景</td></tr>'}
    </tbody></table></div>`
  $('#add').onclick = () => editScene({ order: SCENES.length + 1, published: false })
  $('#view').querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editScene(SCENES.find(s => s._id === b.dataset.edit)) })
  $('#view').querySelectorAll('[data-pub]').forEach(b => { b.onclick = async () => { const s = SCENES.find(x => x._id === b.dataset.pub); await api(`/scenes/${s._id}`, { method: 'PUT', body: { published: !s.published, partial: true } }).catch(fail); route() } })
  $('#view').querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => {
    const s = SCENES.find(x => x._id === b.dataset.del)
    if (count(s._id)) return toast('这个场景里还有单词，先把单词删掉或移到别的场景')
    if (!confirm(`删除场景「${s.name}」？`)) return
    await api(`/scenes/${s._id}`, { method: 'DELETE' }).catch(fail); route()
  } })
}
function editScene(s) {
  dialog(`<h2>${s._id ? '编辑场景' : '新建场景'}</h2>
    <div class="row2"><label>中文名<input name="name" value="${esc(s.name)}" required maxlength="30"></label><label>马来语名<input name="name_ms" value="${esc(s.name_ms)}" maxlength="60"></label></div>
    <div class="row2"><label>排序（数字小的在前）<input name="order" type="number" value="${esc(s.order)}"></label><label>状态<select name="published">${opt('1', '已上架', s.published ? 1 : 0)}${opt('0', '未上架', s.published ? 1 : 0)}</select></label></div>
    <label>封面<input name="cover" value="${esc(s.cover)}" placeholder="犀鸟图名称（c-welcome / c-study / c-pass / c-cheer / c-loading / c-checkin / c-fail）或上传"></label>
    <label>上传封面图片<input type="file" name="file" accept="image/*"></label>`,
  async (f, form) => {
    const cover = (await pickFile(form.file, 'scenes')) || f.get('cover')
    const body = { name: f.get('name'), name_ms: f.get('name_ms'), order: f.get('order'), published: f.get('published') === '1', cover }
    await api(s._id ? `/scenes/${s._id}` : '/scenes', { method: s._id ? 'PUT' : 'POST', body })
    toast('已保存'); route()
  })
}

// ---------- 单词 ----------
const wordFilter = { scene: '', status: '', q: '' }
async function viewWords() {
  ;[SCENES] = await Promise.all([api('/scenes')])
  const words = await api('/words')
  const sceneName = id => (SCENES.find(s => s._id === id) || {}).name || '（未分组）'
  const sOrder = id => (SCENES.find(s => s._id === id) || { order: 999 }).order
  words.sort((a, b) => sOrder(a.sceneId) - sOrder(b.sceneId) || a.order - b.order)
  const list = words.filter(w => (!wordFilter.scene || w.sceneId === wordFilter.scene) && (!wordFilter.status || w.status === wordFilter.status) && (!wordFilter.q || (w.ms + w.zh).toLowerCase().includes(wordFilter.q.toLowerCase())))
  const audioUrls = await urls(list.map(w => w.audio))
  $('#view').innerHTML = `<h1>单词</h1>
    <div class="bar">
      <select id="fScene"><option value="">全部场景</option>${SCENES.map(s => opt(s._id, s.name, wordFilter.scene)).join('')}</select>
      <select id="fStatus">${opt('', '全部状态', wordFilter.status)}${opt('draft', '草稿', wordFilter.status)}${opt('approved', '已审核', wordFilter.status)}</select>
      <input id="fQ" placeholder="搜马来语或中文" value="${esc(wordFilter.q)}">
      <span class="grow"></span>
      <button class="btn" id="tts" ${ME.tts ? '' : 'disabled title="服务器没配置 Azure 发音"'}>给没录音的词生成发音</button>
      <button class="btn" id="imp">批量导入</button>
      <button class="btn primary" id="add">新建单词</button>
    </div>
    <p class="count">显示 ${list.length} / ${words.length} 个；草稿 ${words.filter(w => w.status !== 'approved').length} 个。小程序里，一个场景有已审核的词就只显示已审核的。</p>
    <div class="card scroll"><table class="tbl"><thead><tr><th>马来语</th><th>中文</th><th class="hide-m">词性</th><th class="hide-m">例句</th><th class="hide-m">场景</th><th>发音</th><th>状态</th><th></th></tr></thead><tbody>
    ${list.map(w => `<tr><td class="ms">${esc(w.ms)}</td><td>${esc(w.zh)}</td><td class="hide-m">${esc(w.pos)}</td>
      <td class="hide-m">${esc(w.example_ms)}<br><span class="muted">${esc(w.example_zh)}</span></td><td class="hide-m">${esc(sceneName(w.sceneId))}</td>
      <td>${w.audio ? `<button class="btn sm" data-play="${esc(audioUrls[w.audio] || w.audio)}">▶</button>` : '<span class="muted">无</span>'} ${ME.tts ? `<button class="btn sm" data-tts="${w._id}">生成</button>` : ''}</td>
      <td><button class="btn sm" data-st="${w._id}"><span class="tag ${w.status === 'approved' ? 'ok' : 'draft'}">${w.status === 'approved' ? '已审核' : '草稿'}</span></button></td>
      <td class="ops"><button class="btn sm" data-edit="${w._id}">编辑</button> <button class="btn sm danger" data-del="${w._id}">删除</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">没有符合条件的单词</td></tr>'}
    </tbody></table></div>`
  $('#fScene').onchange = e => { wordFilter.scene = e.target.value; route() }
  $('#fStatus').onchange = e => { wordFilter.status = e.target.value; route() }
  $('#fQ').onchange = e => { wordFilter.q = e.target.value.trim(); route() }
  $('#add').onclick = () => editWord({ sceneId: wordFilter.scene, status: 'draft', order: words.length + 1, pos: '名' })
  $('#imp').onclick = importWords
  $('#tts').onclick = async () => {
    $('#tts').disabled = true; toast('正在生成，一次最多 50 个…')
    try { const r = await api('/words/tts-batch', { method: 'POST', body: { sceneId: wordFilter.scene } }); toast(`生成了 ${r.done} 个${r.errors.length ? `，失败 ${r.errors.length} 个` : ''}`) } catch (e) { fail(e) }
    route()
  }
  const audio = new Audio()
  $('#view').querySelectorAll('[data-play]').forEach(b => { b.onclick = () => { audio.src = b.dataset.play; audio.play().catch(() => toast('播放失败')) } })
  $('#view').querySelectorAll('[data-tts]').forEach(b => { b.onclick = async () => { b.disabled = true; try { await api(`/words/${b.dataset.tts}/tts`, { method: 'POST' }); toast('发音已生成') } catch (e) { fail(e) } route() } })
  $('#view').querySelectorAll('[data-st]').forEach(b => { b.onclick = async () => { const w = words.find(x => x._id === b.dataset.st); await api(`/words/${w._id}`, { method: 'PUT', body: { status: w.status === 'approved' ? 'draft' : 'approved', partial: true } }).catch(fail); route() } })
  $('#view').querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editWord(words.find(w => w._id === b.dataset.edit)) })
  $('#view').querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { const w = words.find(x => x._id === b.dataset.del); if (!confirm(`删除「${w.ms}」？学生的学习记录不会删。`)) return; await api(`/words/${w._id}`, { method: 'DELETE' }).catch(fail); route() } })
}
function editWord(w) {
  dialog(`<h2>${w._id ? '编辑单词' : '新建单词'}</h2>
    <div class="row2"><label>马来语<input name="ms" value="${esc(w.ms)}" required maxlength="80"></label><label>中文释义<input name="zh" value="${esc(w.zh)}" required maxlength="120"></label></div>
    <div class="row2"><label>词性<select name="pos">${POS.map(p => opt(p, p, w.pos)).join('')}</select></label><label>场景<select name="sceneId" required><option value="">请选择</option>${SCENES.map(s => opt(s._id, s.name, w.sceneId)).join('')}</select></label></div>
    <label>例句（马来语）<input name="example_ms" value="${esc(w.example_ms)}" maxlength="300"></label>
    <label>例句（中文）<input name="example_zh" value="${esc(w.example_zh)}" maxlength="300"></label>
    <div class="row2"><label>排序<input name="order" type="number" value="${esc(w.order)}"></label><label>状态<select name="status">${opt('draft', '草稿', w.status)}${opt('approved', '已审核', w.status)}</select></label></div>
    <label>发音（云存储 fileID，可留空，用「生成」自动做）<input name="audio" value="${esc(w.audio)}"></label>`,
  async f => {
    const body = Object.fromEntries(['ms', 'zh', 'pos', 'sceneId', 'example_ms', 'example_zh', 'order', 'status', 'audio'].map(k => [k, f.get(k)]))
    await api(w._id ? `/words/${w._id}` : '/words', { method: w._id ? 'PUT' : 'POST', body })
    toast('已保存'); route()
  })
}
function importWords() {
  const form = dialog(`<h2>批量导入单词</h2>
    <p class="muted">从 Excel / 表格复制粘贴，每行一个词，列顺序：<b>马来语、中文、词性、例句（马来语）、例句（中文）、场景名</b>。第一行是表头也没关系。导入后都是「草稿」。</p>
    <label>没写场景时放到<select name="defaultScene"><option value="">（必须每行写场景）</option>${SCENES.map(s => opt(s._id, s.name, wordFilter.scene)).join('')}</select></label>
    <label>粘贴内容<textarea name="text" rows="7" placeholder="makan	吃	动	Jom makan!	走，去吃饭！	茶室点餐"></textarea></label>
    <button class="btn" type="button" id="pv">预览</button>
    <div class="preview" id="pvBox"></div>`,
  async f => {
    const r = await api('/words/import', { method: 'POST', body: { text: f.get('text'), defaultScene: f.get('defaultScene') } })
    toast(`导入 ${r.added} 个，跳过 ${r.skipped} 个`); route()
  })
  $('#dlgOk').textContent = '确认导入'
  form.querySelector('#pv').onclick = async () => {
    try {
      const r = await api('/words/import', { method: 'POST', body: { text: form.text.value, defaultScene: form.defaultScene.value, dryRun: true } })
      const ok = r.preview.filter(x => !x.error).length
      $('#pvBox').innerHTML = `<p class="count">可导入 ${ok} 行，有问题 ${r.preview.length - ok} 行（有问题的会跳过）</p><table class="tbl"><tr><th>行</th><th>马来语</th><th>中文</th><th>场景</th><th>问题</th></tr>${r.preview.map(x => `<tr><td>${x.line}</td><td>${esc(x.ms)}</td><td>${esc(x.zh)}</td><td>${esc(x.sceneName)}</td><td class="${x.error ? 'bad' : ''}">${esc(x.error || '✓')}</td></tr>`).join('')}</table>`
    } catch (e) { $('#pvBox').textContent = e.message }
  }
}

// ---------- 老师 ----------
async function viewTeachers() {
  const list = (await api('/teachers')).sort((a, b) => a.order - b.order)
  const u = await urls(list.map(t => t.photo))
  $('#view').innerHTML = `<h1>老师</h1>
    <div class="bar"><span class="count grow">小程序「关于老师」页按排序显示：第一位放在最上面，其余放在下方的团队成员里。</span><button class="btn primary" id="add">新建</button></div>
    <div class="card scroll"><table class="tbl"><thead><tr><th>照片</th><th>姓名</th><th class="hide-m">身份</th><th class="hide-m">简介</th><th>排序</th><th></th></tr></thead><tbody>
    ${list.map(t => `<tr><td>${t.photo ? `<img class="thumb" src="${esc(u[t.photo] || t.photo)}" alt="">` : '<span class="thumb"></span>'}</td><td class="ms">${esc(t.name)}<br><span class="muted">${esc(t.role)}</span></td><td class="hide-m">${esc(t.title)}</td><td class="hide-m">${esc((t.bio || '').slice(0, 60))}${(t.bio || '').length > 60 ? '…' : ''}</td><td>${t.order}</td>
      <td class="ops"><button class="btn sm" data-edit="${t._id}">编辑</button> <button class="btn sm danger" data-del="${t._id}">删除</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">还没有老师信息</td></tr>'}
    </tbody></table></div>`
  $('#add').onclick = () => editTeacher({ order: list.length + 1 })
  $('#view').querySelectorAll('[data-edit]').forEach(b => { b.onclick = () => editTeacher(list.find(t => t._id === b.dataset.edit)) })
  $('#view').querySelectorAll('[data-del]').forEach(b => { b.onclick = async () => { const t = list.find(x => x._id === b.dataset.del); if (!confirm(`删除「${t.name}」？`)) return; await api(`/teachers/${t._id}`, { method: 'DELETE' }).catch(fail); route() } })
}
function editTeacher(t) {
  dialog(`<h2>${t._id ? '编辑老师' : '新建老师'}</h2>
    <div class="row2"><label>姓名<input name="name" value="${esc(t.name)}" required maxlength="30"></label><label>角色<input name="role" value="${esc(t.role)}" placeholder="例如：课程主持 / 团队成员" maxlength="30"></label></div>
    <label>身份<input name="title" value="${esc(t.title)}" placeholder="例如：副教授 · 某大学马来语专业教师" maxlength="100"></label>
    <label>简介<textarea name="bio" maxlength="1000">${esc(t.bio)}</textarea></label>
    <div class="row2"><label>排序<input name="order" type="number" value="${esc(t.order)}"></label><label>照片（不超过 5MB）<input type="file" name="file" accept="image/*"></label></div>
    <p class="muted">只写本人同意公开的信息。</p>`,
  async (f, form) => {
    const photo = (await pickFile(form.file, 'teachers')) || t.photo || ''
    const body = { name: f.get('name'), role: f.get('role'), title: f.get('title'), bio: f.get('bio'), order: f.get('order'), photo }
    await api(t._id ? `/teachers/${t._id}` : '/teachers', { method: t._id ? 'PUT' : 'POST', body })
    toast('已保存'); route()
  })
}

// ---------- 学生 ----------
const stuFilter = { q: '', school: '', cls: '' }
async function viewStudents() {
  const all = await api('/students')
  const schools = [...new Set(all.map(s => s.school).filter(Boolean))]
  const classes = [...new Set(all.filter(s => !stuFilter.school || s.school === stuFilter.school).map(s => s.className).filter(Boolean))]
  const list = all.filter(s => (!stuFilter.school || s.school === stuFilter.school) && (!stuFilter.cls || s.className === stuFilter.cls) && (!stuFilter.q || `${s.name}${s.phone}`.includes(stuFilter.q)))
  const t = v => (v ? String(v).replace('T', ' ').slice(0, 16) : '')
  $('#view').innerHTML = `<h1>学生</h1>
    <div class="bar">
      <select id="fSchool"><option value="">全部学校</option>${schools.map(s => opt(s, s, stuFilter.school)).join('')}</select>
      <select id="fCls"><option value="">全部班级</option>${classes.map(c => opt(c, c, stuFilter.cls)).join('')}</select>
      <input id="fQ" placeholder="搜姓名或手机号" value="${esc(stuFilter.q)}">
      <span class="grow"></span><a class="btn" href="/api/students.csv">导出 CSV</a>
    </div>
    <p class="count">共 ${all.length} 人，显示 ${list.length} 人。学生资料由学生在小程序里填写，这里只读。</p>
    <div class="card scroll"><table class="tbl"><thead><tr><th>姓名</th><th>学校 / 班级</th><th class="hide-m">基础</th><th class="hide-m">手机号</th><th>已学词数</th><th class="hide-m">注册时间</th><th>最近活跃</th></tr></thead><tbody>
    ${list.map(s => `<tr><td class="ms">${esc(s.name)}</td><td>${esc(s.school)}<br><span class="muted">${esc(s.className)}</span></td><td class="hide-m">${s.track === 'heritage' ? '会说一些' : '零基础'}</td><td class="hide-m">${esc(s.phone)}</td><td>${s.learned}</td><td class="hide-m">${t(s.createdAt)}</td><td>${t(s.lastActiveAt)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">还没有学生注册</td></tr>'}
    </tbody></table></div>`
  $('#fSchool').onchange = e => { stuFilter.school = e.target.value; stuFilter.cls = ''; route() }
  $('#fCls').onchange = e => { stuFilter.cls = e.target.value; route() }
  $('#fQ').onchange = e => { stuFilter.q = e.target.value.trim(); route() }
}

// ---------- 路由 ----------
const VIEWS = { scenes: viewScenes, words: viewWords, teachers: viewTeachers, students: viewStudents }
async function route() {
  const r = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'words'
  document.querySelectorAll('.side nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r))
  $('#view').innerHTML = '<p class="muted">加载中…</p>'
  try { await (VIEWS[r] || viewWords)() } catch (e) { if (e.message !== '请先登录') $('#view').innerHTML = `<p class="err">${esc(e.message)}</p>` }
}
window.addEventListener('hashchange', () => { if (ME) route() })

// 只有演示模式才在登录页显示演示账号
fetch('/api/mode').then(r => r.json()).then(d => { $('#demoHint').hidden = !d.demo }).catch(() => {})
boot()
