// tab 页 onShow 时调用：让自定义底栏标出当前项
module.exports = (page, i) => { const t = typeof page.getTabBar === 'function' && page.getTabBar(); if (t) t.mark(i) }
