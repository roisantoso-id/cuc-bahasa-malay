// 演示数据:字段和 JomBelajar 接口返回一致,内容是示例,不代表正式课程。
const sense = (partOfSpeech, definition, examples = [], usageNote = null) => ({ partOfSpeech, definition, usageNote, sortOrder: 0, examples })
const ex = (sentence, translation) => ({ sentence, translation, audioResourceId: 'audio-demo', sortOrder: 0 })

const words = [
  { id: 'w-selamat', headword: 'selamat', senses: [sense('Adjective', '平安的；祝……', [ex('Selamat pagi!', '早上好！')])] },
  { id: 'w-pagi', headword: 'pagi', senses: [sense('Noun', '早上', [ex('Saya bangun pada waktu pagi.', '我早上起床。')])] },
  { id: 'w-khabar', headword: 'khabar', senses: [sense('Noun', '消息；近况', [ex('Apa khabar?', '你好吗？')])] },
  { id: 'w-baik', headword: 'baik', senses: [sense('Adjective', '好的', [ex('Khabar baik.', '我很好。')])] },
  { id: 'w-terima-kasih', headword: 'terima kasih', senses: [sense('Interjection', '谢谢', [ex('Terima kasih, cikgu.', '谢谢老师。')])] },
  { id: 'w-nama', headword: 'nama', senses: [sense('Noun', '名字', [ex('Siapa nama awak?', '你叫什么名字？')])] },
  { id: 'w-saya', headword: 'saya', senses: [sense('Pronoun', '我', [ex('Nama saya Ali.', '我叫阿里。')])] },
  { id: 'w-makan', headword: 'makan', senses: [sense('Verb', '吃', [ex('Awak sudah makan?', '你吃了吗？')], '口语常说 dah makan')] },
  { id: 'w-pergi', headword: 'pergi', senses: [sense('Verb', '去', [ex('Saya pergi ke sekolah.', '我去学校。')])] },
  { id: 'w-buku', headword: 'buku', senses: [sense('Noun', '书', [ex('Ini buku saya.', '这是我的书。')])] },
  { id: 'w-teh', headword: 'teh', senses: [sense('Noun', '茶（来自闽南话「茶」）', [ex('Saya mahu teh tarik.', '我要一杯拉茶。')])] },
  { id: 'w-cantik', headword: 'cantik', senses: [sense('Adjective', '漂亮的', [ex('Bunga ini cantik.', '这朵花很漂亮。')])] }
].map((w, i) => ({ ...w, audioResourceId: 'audio-demo', studyOrder: i + 1 }))

const author = { id: 'u-editor', nickname: 'JomBelajar 编辑', avatarUrl: null }

const articleCategories = [
  { id: 'ac-daily', name: '日常会话', slug: 'daily', description: null, isActive: true, articleCount: 2 },
  { id: 'ac-culture', name: '马来西亚文化', slug: 'culture', description: null, isActive: true, articleCount: 1 }
]

const articles = [
  {
    id: 'a-kopitiam', title: 'Di kopitiam：在茶室点饮料', summary: '学会在马来西亚茶室点一杯拉茶。',
    categories: [articleCategories[0]], coverUrl: null, author, publishedAt: '2026-10-10T02:00:00Z', updatedAt: '2026-10-10T02:00:00Z',
    readingAudioResourceId: 'audio-demo',
    contentHtml: '<h2>对话</h2><p><strong>Pelayan:</strong> Nak minum apa?</p><p>服务员：要喝什么？</p><p><strong>Ali:</strong> Teh tarik satu, kurang manis.</p><p>阿里：一杯拉茶，少甜。</p><h2>词语</h2><ul><li><strong>minum</strong> 喝</li><li><strong>kurang manis</strong> 少甜</li></ul>'
  },
  {
    id: 'a-salam', title: 'Salam：马来语怎么打招呼', summary: '早上、下午、晚上的问候各不相同。',
    categories: [articleCategories[0]], coverUrl: null, author, publishedAt: '2026-10-08T02:00:00Z', updatedAt: '2026-10-08T02:00:00Z',
    readingAudioResourceId: null,
    contentHtml: '<p>马来语按时间段问候：</p><ul><li><strong>Selamat pagi</strong> 早上好</li><li><strong>Selamat tengah hari</strong> 中午好</li><li><strong>Selamat petang</strong> 下午好</li><li><strong>Selamat malam</strong> 晚上好</li></ul>'
  },
  {
    id: 'a-hokkien', title: '马来语里的闽南话', summary: 'teh、tauhu、kuih……这些词你可能已经会了。',
    categories: [articleCategories[1]], coverUrl: null, author, publishedAt: '2026-10-05T02:00:00Z', updatedAt: '2026-10-05T02:00:00Z',
    readingAudioResourceId: null,
    contentHtml: '<p>很多日常马来语来自闽南话：</p><ul><li><strong>teh</strong> 茶</li><li><strong>tauhu</strong> 豆腐</li><li><strong>bihun</strong> 米粉</li><li><strong>kuih</strong> 糕点（粿）</li></ul>'
  }
]

const videoCategories = [{ id: 'vc-daily', name: '情景对话', slug: 'daily', description: null, isActive: true, videoCount: 2 }]
const videos = [
  { id: 'v-market', title: 'Di pasar：在菜市场', description: '跟着摊主学数字和讨价还价。', durationSeconds: 245, author, coverUrl: null, publishedAt: '2026-10-09T02:00:00Z', categories: videoCategories, displayWidth: 1280, displayHeight: 720 },
  { id: 'v-intro', title: 'Perkenalan：自我介绍', description: '用五句话介绍自己。', durationSeconds: 180, author, coverUrl: null, publishedAt: '2026-10-06T02:00:00Z', categories: videoCategories, displayWidth: 1280, displayHeight: 720 }
]

const paperCategories = [{ id: 'pc-basic', name: '入门测试', slug: 'basic', description: null, isActive: true, paperCount: 2 }]
const opt = (id, text, sortOrder) => ({ id, text, sortOrder })
const papers = [
  {
    id: 'p-salam', title: '入门测试 1：问候', description: '检查你对问候语的掌握。', instructions: '本试卷包含选择题、判断题、填空题和听写题，提交后由系统自动判分。',
    categories: paperCategories, passingScore: 6, publishedAt: '2026-10-10T02:00:00Z',
    questions: [
      { id: 'q1', type: 'SingleChoice', prompt: '「Apa khabar?」是什么意思？', points: 2, sortOrder: 1, options: [opt('q1a', '早上好', 1), opt('q1b', '你好吗？', 2), opt('q1c', '谢谢', 3), opt('q1d', '再见', 4)], correctOptionId: 'q1b', explanation: 'khabar 是「消息、近况」，Apa khabar 直译是「什么消息」，即「你好吗」。' },
      { id: 'q2', type: 'TrueFalse', prompt: '「Terima kasih」的意思是「谢谢」。', points: 2, sortOrder: 2, options: [], correctBoolean: true, explanation: 'terima 是「接受」，kasih 是「爱、好意」。' },
      { id: 'q3', type: 'FillBlank', prompt: '「早上好」：Selamat ____', points: 3, sortOrder: 3, options: [], acceptedAnswers: ['pagi'], explanation: 'pagi 是早上。' },
      { id: 'q4', type: 'Dictation', prompt: '听录音，写出句子里的两个词：____ ____ Ali.', points: 3, sortOrder: 4, options: [], audioResourceId: 'audio-demo', dictationBlanks: [{ sortOrder: 1 }, { sortOrder: 2 }], dictationAnswers: [['nama'], ['saya']], explanation: '原句：Nama saya Ali.（我叫阿里。）' }
    ]
  },
  {
    id: 'p-number', title: '入门测试 2：数字', description: '1 到 10 的数字。', instructions: null,
    categories: paperCategories, passingScore: 3, publishedAt: '2026-10-11T02:00:00Z',
    questions: [
      { id: 'n1', type: 'SingleChoice', prompt: '「tiga」是几？', points: 2, sortOrder: 1, options: [opt('n1a', '2', 1), opt('n1b', '3', 2), opt('n1c', '4', 3)], correctOptionId: 'n1b', explanation: 'satu 1, dua 2, tiga 3。' },
      { id: 'n2', type: 'FillBlank', prompt: '「十」用马来语写作 ____', points: 3, sortOrder: 2, options: [], acceptedAnswers: ['sepuluh'], explanation: 'sepuluh 是十。' }
    ]
  }
]

module.exports = { words, articles, articleCategories, videos, videoCategories, papers, paperCategories }
