// 示例课程(先跑通流程用)。正式内容由教授团队提供后替换,或导入云数据库。
// track: zero = 零基础,heritage = 有基础(马来西亚华人)
// 句子 / 生词可加 audio 字段(云存储 fileID 或 https 地址),有就显示播放。
module.exports = [
  {
    id: 'zero-1',
    track: 'zero',
    title: '入门',
    desc: '打招呼、数字',
    lessons: [
      {
        id: 'z1-01',
        title: 'Selamat pagi',
        zh: '问候',
        sentences: [
          { ms: 'Selamat pagi.', zh: '早上好。' },
          { ms: 'Apa khabar?', zh: '你好吗？' },
          { ms: 'Khabar baik, terima kasih.', zh: '我很好，谢谢。' },
          { ms: 'Siapa nama awak?', zh: '你叫什么名字？' },
          { ms: 'Nama saya Ali.', zh: '我叫阿里。' },
          { ms: 'Selamat tinggal.', zh: '再见。（离开的人对留下的人说）' }
        ],
        words: [
          { ms: 'selamat', zh: '平安；祝', pos: '形' },
          { ms: 'pagi', zh: '早上', pos: '名' },
          { ms: 'apa', zh: '什么', pos: '代' },
          { ms: 'khabar', zh: '消息；近况', pos: '名' },
          { ms: 'baik', zh: '好', pos: '形' },
          { ms: 'terima kasih', zh: '谢谢', pos: '短语' },
          { ms: 'siapa', zh: '谁', pos: '代' },
          { ms: 'nama', zh: '名字', pos: '名' },
          { ms: 'awak', zh: '你', pos: '代' },
          { ms: 'saya', zh: '我', pos: '代' }
        ]
      },
      {
        id: 'z1-02',
        title: 'Berapa harga ini?',
        zh: '数字和买东西',
        sentences: [
          { ms: 'Berapa harga ini?', zh: '这个多少钱？' },
          { ms: 'Lima ringgit.', zh: '五令吉。' },
          { ms: 'Saya mahu dua.', zh: '我要两个。' },
          { ms: 'Semuanya sepuluh ringgit.', zh: '一共十令吉。' }
        ],
        words: [
          { ms: 'satu', zh: '一', pos: '数' },
          { ms: 'dua', zh: '二', pos: '数' },
          { ms: 'tiga', zh: '三', pos: '数' },
          { ms: 'empat', zh: '四', pos: '数' },
          { ms: 'lima', zh: '五', pos: '数' },
          { ms: 'sepuluh', zh: '十', pos: '数' },
          { ms: 'berapa', zh: '多少', pos: '代' },
          { ms: 'harga', zh: '价格', pos: '名' },
          { ms: 'ini', zh: '这', pos: '代' },
          { ms: 'mahu', zh: '要；想要', pos: '动' }
        ]
      }
    ]
  },
  {
    id: 'heritage-1',
    track: 'heritage',
    title: '书面语',
    desc: '口语说法对应的标准写法',
    lessons: [
      {
        id: 'h1-01',
        title: 'Tak → Tidak',
        zh: '口语和书面语',
        sentences: [
          { ms: 'Saya tidak tahu.', zh: '我不知道。（口语常说 tak tahu）' },
          { ms: 'Awak hendak pergi ke mana?', zh: '你要去哪里？（口语常说 nak pergi mana）' },
          { ms: 'Awak sudah makan?', zh: '你吃了吗？（口语常说 dah makan）' },
          { ms: 'Bagaimana keadaan awak?', zh: '你情况怎么样？（口语常说 camne）' }
        ],
        words: [
          { ms: 'tidak', zh: '不（口语 tak）', pos: '副' },
          { ms: 'tahu', zh: '知道', pos: '动' },
          { ms: 'hendak', zh: '要；想（口语 nak）', pos: '助' },
          { ms: 'pergi', zh: '去', pos: '动' },
          { ms: 'sudah', zh: '已经（口语 dah）', pos: '副' },
          { ms: 'makan', zh: '吃', pos: '动' },
          { ms: 'bagaimana', zh: '怎么样（口语 macam mana）', pos: '代' },
          { ms: 'keadaan', zh: '情况', pos: '名' }
        ]
      }
    ]
  }
]
