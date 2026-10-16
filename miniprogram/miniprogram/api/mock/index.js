// 演示模式(config.useMock = true):在本地模拟 JomBelajar 接口,返回结构和真实接口一致。
// 只为没有后端时也能把页面点一遍,逻辑是简化版(不是真的 FSRS)。
const D = require('./data')

let seq = 0
const uid = p => `${p}-${Date.now().toString(36)}-${++seq}`
const now = () => new Date().toISOString()
const dayStr = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86400000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const paged = (list, q) => {
  const page = Number(q.page || 1)
  const pageSize = Number(q.pageSize || 20)
  return { items: list.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: list.length, totalPages: Math.max(1, Math.ceil(list.length / pageSize)) }
}
const ok = (data, statusCode = 200) => ({ statusCode, data, header: {} })
const fail = (statusCode, errorCode, detail) => ({ statusCode, data: { status: statusCode, errorCode, detail, title: detail }, header: {} })
const wordById = id => D.words.find(w => w.id === id)

// ---------------- 用户状态 ----------------
const S = {
  user: { id: 'u-demo', email: 'demo@bahasa.cn', role: 'User', nickname: '小犀鸟同学', avatarUrl: null, bio: '', createdAt: '2026-10-01T00:00:00Z' },
  settings: { dailyWordStudyCount: 5, dailyWordReviewCount: 50, desiredRetention: 0.9 },
  // 演示:前 3 个词已学过且今天到期复习
  progress: Object.fromEntries(D.words.slice(0, 3).map(w => [w.id, { due: dayStr(0) }])),
  favorites: {},
  exclusions: {},
  activities: [], // 今日回顾
  checkIns: [dayStr(-3), dayStr(-2), dayStr(-1)], // 演示:已连续打卡 3 天
  sessions: {},
  active: { Learning: null, Review: null },
  videoProgress: {},
  attempts: {},
  wrong: {}
}

// ---------------- 单词学习 ----------------
const PREVIEWS = [{ rating: 'Again', intervalSeconds: 60 }, { rating: 'Hard', intervalSeconds: 600 }, { rating: 'Good', intervalSeconds: 86400 }, { rating: 'Easy', intervalSeconds: 345600 }]

function newSession(type, wordIds) {
  const s = { id: uid('s'), sessionType: type, phase: 'Memorization', status: 'Active', startedAt: now(), completedAt: null, items: {}, queue: [], ratings: { Again: 0, Hard: 0, Good: 0, Easy: 0 } }
  wordIds.forEach((wid, i) => {
    const it = { itemId: uid('i'), wordId: wid, position: i + 1, stamp: uid('st'), status: 'Pending', memPassed: false, spellPassed: false, hadMemorizationFailure: false, hadSpellingFailure: false }
    s.items[it.itemId] = it
    s.queue.push(it.itemId)
  })
  S.sessions[s.id] = s
  S.active[type] = s.id
  return s
}

function project(s) {
  const items = Object.values(s.items)
  const head = s.status === 'Active' && s.phase !== 'Summary' ? s.items[s.queue[0]] : null
  let currentItem = null
  if (head) {
    const w = wordById(head.wordId)
    currentItem = { phase: s.phase, itemId: head.itemId, wordId: w.id, itemConcurrencyStamp: head.stamp, isFavorite: !!S.favorites[w.id] }
    if (s.phase === 'Memorization') currentItem.memorization = { headword: w.headword, senses: w.senses, audioResourceId: w.audioResourceId, ratingPreviews: PREVIEWS }
    else currentItem.spelling = { senses: w.senses.map(x => ({ partOfSpeech: x.partOfSpeech, definition: x.definition })) }
  }
  const excludedCount = items.filter(i => i.status === 'Excluded').length
  const skippedCount = items.filter(i => i.status === 'Skipped').length
  const r = s.ratings
  return {
    id: s.id, sessionType: s.sessionType, phase: s.phase, status: s.status,
    actualCount: items.length, completedCount: items.filter(i => i.status === 'Completed').length,
    memorizationPassedCount: items.filter(i => i.memPassed).length, spellingPassedCount: items.filter(i => i.spellPassed).length,
    excludedCount, skippedCount, startedAt: s.startedAt, completedAt: s.completedAt, nextAvailableAt: null,
    currentItem,
    newCount: s.sessionType === 'Learning' ? items.filter(i => !i.memPassed && i.status === 'Pending').length : 0,
    learningCount: 0,
    reviewCount: s.sessionType === 'Review' ? items.filter(i => !i.memPassed && i.status === 'Pending').length : 0,
    summary: s.phase === 'Summary' ? { wordCount: items.length - excludedCount, ratingCount: r.Again + r.Hard + r.Good + r.Easy, againCount: r.Again, hardCount: r.Hard, goodCount: r.Good, easyCount: r.Easy } : null
  }
}

function activity(s, it) {
  const w = wordById(it.wordId)
  S.activities = S.activities.filter(a => a.wordId !== w.id)
  S.activities.unshift({ wordId: w.id, headword: w.headword, activityType: s.sessionType, completedAtUtc: now(), senses: w.senses, audioResourceId: w.audioResourceId })
}

function complete(s) {
  s.status = 'Completed'
  s.completedAt = now()
  s.queue = []
  Object.values(s.items).forEach(it => { if (it.status === 'Pending') it.status = 'Completed' })
  S.active[s.sessionType] = null
  if (s.sessionType === 'Learning' && !S.checkIns.includes(dayStr(0))) S.checkIns.push(dayStr(0))
}

function checkHead(s, itemId, stamp) {
  if (!s || s.status !== 'Active') return fail(409, 'WordStudyPhaseConflict', '本组学习已结束')
  if (s.queue[0] !== itemId) return fail(409, 'WordStudyQueueConflict', '学习进度已变化，请刷新')
  if (s.items[itemId].stamp !== stamp) return fail(409, 'WordStudyConcurrencyConflict', '学习进度已变化，请刷新')
  return null
}

function wordStudy(method, parts, body) {
  const [mode, a, sid, b, itemId, action] = parts // word-study/{mode}/sessions/{sid}/items/{itemId}/{action}
  const type = mode === 'learning' ? 'Learning' : 'Review'
  if (mode === 'review' && a === 'today') {
    const items = S.activities.map(x => ({ ...x, isFavorite: !!S.favorites[x.wordId] }))
    return ok({ studyDateUtc: dayStr(0), ...paged(items, body || {}) })
  }
  if (mode === 'check-ins') {
    const sorted = [...S.checkIns].sort()
    // 连续天数:今天没打卡就从昨天往前数
    let cur = 0
    for (let i = sorted.includes(dayStr(0)) ? 0 : 1; sorted.includes(dayStr(-i)); i++) cur++
    return ok({ year: body.year, month: body.month, checkedInDates: sorted.map(d => ({ studyDateUtc: d, checkedInAtUtc: `${d}T10:00:00Z` })), currentStreak: cur, longestStreak: Math.max(cur, 3), totalCheckInDays: sorted.length })
  }
  const active = S.active[type] ? project(S.sessions[S.active[type]]) : null
  if (a === 'overview') {
    if (type === 'Learning') {
      const learned = D.words.filter(w => S.progress[w.id]).length
      const todayLearned = S.activities.filter(x => x.activityType === 'Learning').length
      return ok({ totalLearnedCount: learned, todayLearnedCount: todayLearned, hasMoreWords: learned < D.words.length, activeSession: active })
    }
    const due = D.words.filter(w => S.progress[w.id] && S.progress[w.id].due <= dayStr(0) && !S.exclusions[w.id]).length
    return ok({ dueCount: due, overdueCount: 0, activeSession: active })
  }
  if (a !== 'sessions') return fail(404, 'NotFound', '接口不存在')
  if (!sid && method === 'POST') {
    if (active) return ok(active)
    const ids = type === 'Learning'
      ? D.words.filter(w => !S.progress[w.id]).slice(0, S.settings.dailyWordStudyCount).map(w => w.id)
      : D.words.filter(w => S.progress[w.id] && S.progress[w.id].due <= dayStr(0) && !S.exclusions[w.id]).map(w => w.id)
    if (!ids.length) return type === 'Learning' ? fail(409, 'WordStudyNoEligibleWords', '没有可学习的新词') : fail(409, 'WordReviewNoDueWords', '没有到期的复习')
    return ok(project(newSession(type, ids)), 201)
  }
  const s = S.sessions[sid]
  if (!s) return fail(404, 'WordStudySessionNotFound', '学习记录不存在')
  if (method === 'GET' && !b) return ok(project(s))
  if (b === 'results') {
    return ok(Object.values(s.items).map(i => ({ itemId: i.itemId, wordId: i.wordId, position: i.position, status: i.status, headword: wordById(i.wordId).headword, hadMemorizationFailure: i.hadMemorizationFailure, hadSpellingFailure: i.hadSpellingFailure })))
  }
  if (b === 'summary') {
    if (body.skipSpelling) complete(s)
    else { s.phase = 'Spelling'; s.queue = Object.values(s.items).filter(i => i.status === 'Pending').map(i => i.itemId) }
    return ok(project(s))
  }
  if (b === 'spelling') {
    s.phase = 'Spelling'
    s.queue = Object.values(s.items).filter(i => i.status === 'Pending' && i.memPassed).map(i => i.itemId)
    return ok(project(s))
  }
  if (b === 'more') {
    const ids = D.words.filter(w => !S.progress[w.id] && !Object.values(s.items).some(i => i.wordId === w.id)).slice(0, S.settings.dailyWordStudyCount).map(w => w.id)
    ids.forEach((wid, k) => {
      const it = { itemId: uid('i'), wordId: wid, position: Object.keys(s.items).length + k + 1, stamp: uid('st'), status: 'Pending', memPassed: false, spellPassed: false, hadMemorizationFailure: false, hadSpellingFailure: false }
      s.items[it.itemId] = it
      s.queue.push(it.itemId)
    })
    s.phase = 'Memorization'
    return ok(project(s))
  }
  if (b === 'items') {
    const err = checkHead(s, itemId, body.itemConcurrencyStamp)
    if (err) return err
    const it = s.items[itemId]
    s.queue.shift()
    it.stamp = uid('st')
    let spellingOutcome = null
    if (action === 'memorization') {
      s.ratings[body.result] = (s.ratings[body.result] || 0) + 1
      if (body.result === 'Again') { it.hadMemorizationFailure = true; s.queue.push(itemId) }
      else {
        it.memPassed = true
        S.progress[it.wordId] = { due: dayStr(body.result === 'Easy' ? 4 : body.result === 'Good' ? 1 : 0) }
        activity(s, it)
      }
      if (!s.queue.length) s.phase = 'Summary'
    } else if (action === 'spelling') {
      const w = wordById(it.wordId)
      if (body.skip) it.status = 'Skipped'
      else {
        const right = body.answer.trim().toLowerCase() === w.headword.toLowerCase()
        spellingOutcome = { result: right ? 'Correct' : 'Incorrect', correctAnswer: w.headword }
        if (right) { it.spellPassed = true; it.status = 'Completed' } else { it.hadSpellingFailure = true; s.queue.push(itemId) }
      }
      if (!s.queue.length) complete(s)
    } else if (action === 'exclude') {
      it.status = 'Excluded'
      S.exclusions[it.wordId] = now()
      if (!s.queue.length) s.phase = 'Summary'
    }
    return ok({ spellingOutcome, session: project(s) })
  }
  return fail(404, 'NotFound', '接口不存在')
}

// ---------------- 试卷 ----------------
const paperSummary = p => ({ id: p.id, title: p.title, description: p.description, categories: p.categories, questionCount: p.questions.length, totalScore: p.questions.reduce((n, q) => n + q.points, 0), passingScore: p.passingScore, publishedAt: p.publishedAt })
const publicQuestion = (q, saved) => ({ id: q.id, type: q.type, prompt: q.prompt, points: q.points, sortOrder: q.sortOrder, options: q.options, savedAnswer: saved || null, audioResourceId: q.audioResourceId || null, dictationBlanks: q.dictationBlanks || [] })
const norm = s => String(s || '').trim().toLowerCase()

function judge(q, a) {
  if (!a) return false
  if (q.type === 'SingleChoice') return a.selectedOptionId === q.correctOptionId
  if (q.type === 'TrueFalse') return a.booleanAnswer === q.correctBoolean
  if (q.type === 'FillBlank') return q.acceptedAnswers.some(x => norm(x) === norm(a.textAnswer))
  return (a.textAnswers || []).length === q.dictationAnswers.length && q.dictationAnswers.every((acc, i) => acc.some(x => norm(x) === norm(a.textAnswers[i])))
}

function attemptView(at) {
  const p = D.papers.find(x => x.id === at.paperId)
  const s = paperSummary(p)
  return { id: at.id, paperId: p.id, attemptNumber: at.attemptNumber, status: at.status, title: p.title, description: p.description, instructions: p.instructions, questionCount: s.questionCount, paperTotalScore: s.totalScore, paperPassingScore: p.passingScore, startedAt: at.startedAt, submittedAt: at.submittedAt, questions: p.questions.map(q => publicQuestion(q, at.answers[q.id])) }
}

function resultView(at) {
  const p = D.papers.find(x => x.id === at.paperId)
  const s = paperSummary(p)
  const questions = p.questions.map(q => {
    const a = at.answers[q.id] || {}
    const isCorrect = judge(q, at.answers[q.id])
    return {
      questionId: q.id, type: q.type, prompt: q.prompt, explanation: q.explanation, points: q.points, sortOrder: q.sortOrder, options: q.options,
      selectedOptionId: a.selectedOptionId || null, booleanAnswer: a.booleanAnswer === undefined ? null : a.booleanAnswer, textAnswer: a.textAnswer || null, textAnswers: a.textAnswers || null,
      isAnswered: !!at.answers[q.id], correctOptionId: q.correctOptionId || null, correctBoolean: q.correctBoolean === undefined ? null : q.correctBoolean,
      acceptedAnswers: q.acceptedAnswers || [], dictationAnswers: q.dictationAnswers || null, isCorrect, awardedPoints: isCorrect ? q.points : 0, audioResourceId: q.audioResourceId || null
    }
  })
  const score = questions.reduce((n, q) => n + q.awardedPoints, 0)
  return { id: at.id, paperId: p.id, attemptNumber: at.attemptNumber, paperTitle: p.title, score, paperTotalScore: s.totalScore, paperPassingScore: p.passingScore, isPassed: score >= p.passingScore, startedAt: at.startedAt, submittedAt: at.submittedAt, questions }
}

function wrongView(w, detail) {
  const p = D.papers.find(x => x.id === w.paperId)
  const q = p.questions.find(x => x.id === w.questionId)
  const v = { id: w.id, questionId: q.id, paperId: p.id, paperTitle: p.title, status: w.status, type: q.type, prompt: q.prompt, audioResourceId: q.audioResourceId || null, wrongCount: w.wrongCount, redoCount: w.redoCount, firstWrongAt: w.firstWrongAt, lastWrongAt: w.lastWrongAt, lastRedoAt: w.lastRedoAt, masteredAt: w.masteredAt, concurrencyStamp: w.stamp }
  if (detail) Object.assign(v, { points: q.points, options: q.options, dictationBlanks: q.dictationBlanks || [] })
  return v
}

function papers(method, parts, body, q) {
  const [root, id, sub, qid] = parts
  if (root === 'paper-categories') return ok(paged(D.paperCategories, q))
  if (root === 'papers') {
    if (!id) {
      let list = D.papers
      if (q.categoryId) list = list.filter(p => p.categories.some(c => c.id === q.categoryId))
      if (q.keyword) list = list.filter(p => p.title.includes(q.keyword))
      return ok(paged(list.map(paperSummary), q))
    }
    const p = D.papers.find(x => x.id === id)
    if (!p) return fail(404, 'PaperNotFound', '试卷不存在或已下架')
    if (!sub) return ok({ ...paperSummary(p), instructions: p.instructions })
    if (sub === 'attempts' && method === 'POST') {
      const open = Object.values(S.attempts).find(a => a.paperId === id && a.status === 'InProgress')
      if (open) return ok(attemptView(open))
      const n = Object.values(S.attempts).filter(a => a.paperId === id).length + 1
      const at = { id: uid('at'), paperId: id, attemptNumber: n, status: 'InProgress', startedAt: now(), submittedAt: null, answers: {} }
      S.attempts[at.id] = at
      return ok(attemptView(at), 201)
    }
    if (sub === 'attempts') {
      const list = Object.values(S.attempts).filter(a => a.paperId === id).map(a => { const r = resultView(a); return { id: a.id, paperId: id, attemptNumber: a.attemptNumber, status: a.status, score: a.status === 'Submitted' ? r.score : null, paperTotalScore: r.paperTotalScore, isPassed: a.status === 'Submitted' ? r.isPassed : null, startedAt: a.startedAt, submittedAt: a.submittedAt } })
      return ok(paged(list, q))
    }
  }
  if (root === 'paper-attempts') {
    const at = S.attempts[id]
    if (!at) return fail(404, 'PaperAttemptNotFound', '测试不存在')
    if (!sub) return ok(attemptView(at))
    if (sub === 'answers') {
      if (at.status !== 'InProgress') return fail(409, 'PaperAttemptConcurrencyConflict', '试卷已提交')
      if (method === 'DELETE') delete at.answers[qid]
      else at.answers[qid] = { ...body, savedAt: now() }
      return ok(null, 204)
    }
    if (sub === 'submit' || sub === 'result') {
      if (sub === 'submit' && at.status === 'InProgress') {
        at.status = 'Submitted'
        at.submittedAt = now()
        const p = D.papers.find(x => x.id === at.paperId)
        p.questions.filter(x => !judge(x, at.answers[x.id])).forEach(x => {
          const w = Object.values(S.wrong).find(y => y.questionId === x.id)
          if (w) { w.wrongCount++; w.lastWrongAt = now(); w.status = 'Pending'; w.masteredAt = null }
          else { const nw = { id: uid('wq'), questionId: x.id, paperId: p.id, status: 'Pending', wrongCount: 1, redoCount: 0, firstWrongAt: now(), lastWrongAt: now(), lastRedoAt: null, masteredAt: null, stamp: uid('st') }; S.wrong[nw.id] = nw }
        })
      }
      if (at.status !== 'Submitted') return fail(409, 'PaperAttemptNotSubmitted', '试卷还没有提交')
      return ok(resultView(at))
    }
  }
  if (root === 'paper-wrong-questions') {
    if (!id) {
      const list = Object.values(S.wrong).filter(w => w.status === (q.status || 'Pending')).map(w => wrongView(w))
      return ok(paged(list, q))
    }
    const w = S.wrong[id]
    if (!w) return fail(404, 'WrongQuestionNotFound', '错题不存在')
    if (!sub) return ok(wrongView(w, true))
    const p = D.papers.find(x => x.id === w.paperId)
    const qq = p.questions.find(x => x.id === w.questionId)
    const right = judge(qq, body)
    w.redoCount++
    w.lastRedoAt = now()
    if (right) { w.status = 'Mastered'; w.masteredAt = now() } else { w.status = 'Pending'; w.wrongCount++; w.lastWrongAt = now() }
    return ok({ ...wrongView(w), isCorrect: right, explanation: qq.explanation, ...body, correctOptionId: qq.correctOptionId || null, correctBoolean: qq.correctBoolean === undefined ? null : qq.correctBoolean, acceptedAnswers: qq.acceptedAnswers || [], dictationAnswers: qq.dictationAnswers || [] })
  }
  return fail(404, 'NotFound', '接口不存在')
}

// ---------------- 路由 ----------------
function route(method, path, body) {
  const [p, query = ''] = path.split('?')
  const q = Object.fromEntries(query.split('&').filter(Boolean).map(kv => kv.split('=').map(decodeURIComponent)))
  const parts = p.split('/').filter(Boolean)
  const [r0, r1, r2] = parts

  if (r0 === 'auth') {
    if (r1 === 'login') {
      if (!body.email || (body.password || '').length < 8) return fail(401, 'InvalidCredentials', '邮箱或密码不正确')
      return { statusCode: 200, data: { token: 'mock-token', expiresIn: 900, user: { id: S.user.id, email: S.user.email, role: 'User' } }, header: { 'Set-Cookie': 'tiny-lang.refresh=mock-refresh; Path=/api/auth; HttpOnly' } }
    }
    if (r1 === 'refresh') return ok({ token: 'mock-token', expiresIn: 900, user: { id: S.user.id, email: S.user.email, role: 'User' } })
    if (r1 === 'register') return ok({ id: S.user.id, email: body.email, role: 'User' })
    if (r1 === 'logout') return ok(null, 204)
    return ok(null) // 各种发验证码、找回密码
  }
  if (r0 === 'users') {
    if (r1 !== 'me') return ok({ id: r1, nickname: null, avatarUrl: null, bio: null })
    if (!r2) return ok(S.user)
    if (r2 === 'profile') { Object.assign(S.user, { nickname: body.nickname, bio: body.bio }); if (body.avatarMediaResourceId) S.user.avatarUrl = null; return ok(S.user) }
    if (r2 === 'word-study-settings') { if (method === 'PUT') Object.assign(S.settings, body); return ok(S.settings) }
    if (r2 === 'word-favorites') {
      if (parts[3]) { if (method === 'PUT') S.favorites[parts[3]] = now(); else delete S.favorites[parts[3]]; return ok(null, 204) }
      return ok(paged(Object.keys(S.favorites).map(id => { const w = wordById(id); return { wordId: id, headword: w.headword, senses: w.senses, audioResourceId: w.audioResourceId, createdAt: S.favorites[id] } }), q))
    }
    if (r2 === 'word-review-exclusions') {
      if (parts[3]) { delete S.exclusions[parts[3]]; S.progress[parts[3]] = { due: dayStr(1) }; return ok(null, 204) }
      return ok(paged(Object.keys(S.exclusions).map(id => { const w = wordById(id); return { wordId: id, headword: w.headword, senses: w.senses, audioResourceId: w.audioResourceId, excludedAt: S.exclusions[id] } }), q))
    }
    if (r2 === 'change-email') { S.user.email = body.newEmail; return ok({ id: S.user.id, email: body.newEmail }) }
    return ok(null, 204) // reset-password / delete-account
  }
  if (r0 === 'uploads') {
    if (r2 === 'avatar') return ok({ resourceId: uid('m'), presignedUrl: '', objectName: '' })
    return ok({ id: parts[2], status: 'Ready', url: null })
  }
  if (r0 === 'word-study') return wordStudy(method, parts.slice(1), method === 'GET' ? q : body)
  if (r0 === 'words') return r1 ? ok(wordById(r1)) : ok(paged(D.words.map(w => ({ id: w.id, headword: w.headword, partOfSpeech: w.senses[0].partOfSpeech, definition: w.senses[0].definition, audioResourceId: w.audioResourceId, updatedAt: now() })), q))
  if (r0 === 'articles') {
    if (r1) { const a = D.articles.find(x => x.id === r1); return a ? ok(a) : fail(404, 'ArticleNotFound', '文章不存在') }
    let list = D.articles
    if (q.categoryId) list = list.filter(a => a.categories.some(c => c.id === q.categoryId))
    if (q.keyword) list = list.filter(a => a.title.includes(q.keyword) || (a.summary || '').includes(q.keyword))
    return ok(paged(list.map(({ contentHtml, readingAudioResourceId, ...rest }) => ({ ...rest, status: 'Published' })), q))
  }
  if (r0 === 'article-categories') return ok(paged(D.articleCategories, q))
  if (r0 === 'video-categories') return ok(paged(D.videoCategories, q))
  if (r0 === 'videos') {
    if (!r1) {
      let list = D.videos
      if (q.keyword) list = list.filter(v => v.title.includes(q.keyword))
      return ok(paged(list, q))
    }
    const v = D.videos.find(x => x.id === r1)
    if (!v) return fail(404, 'VideoNotFound', '视频不存在')
    if (r2 === 'playback') return ok({ masterPlaylistUrl: '', posterUrl: null, expiresAt: null, durationSeconds: v.durationSeconds, positionSeconds: S.videoProgress[r1] || 0, isCompleted: false })
    if (r2 === 'progress') { S.videoProgress[r1] = body.positionSeconds; return ok(null, 204) }
    return ok(v)
  }
  // 演示数据没有真实录音:返回空地址,页面提示「演示数据没有录音」
  if (r0 === 'audio') return ok({ url: '', expiresAt: null, durationSeconds: 0 })
  if (['papers', 'paper-categories', 'paper-attempts', 'paper-wrong-questions'].includes(r0)) return papers(method, parts, body, q)
  return fail(404, 'NotFound', '接口不存在')
}

function handle(method, path, data) {
  return new Promise(resolve => setTimeout(() => resolve(route(method, path, data || {})), 120))
}

module.exports = { handle }
