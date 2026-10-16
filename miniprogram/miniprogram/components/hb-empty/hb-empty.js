// 空状态 / 出错 / 加载中:犀鸟图 + 一句话 + 可选按钮(slot)
Component({
  properties: {
    image: { type: String, value: 'empty' }, // assets 里的文件名
    title: String,
    desc: String
  }
})
