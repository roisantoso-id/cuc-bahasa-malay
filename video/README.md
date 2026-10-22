# 介绍视频

- 成片：`JomBelajar-介绍-竖屏.mp4`，1080×1920，60 秒，中文配音。给小红书、视频号、抖音用。
- 源码：`source/`（Remotion）。工作目录在 `~/Projects/jombelajar-video`，不在桌面，以免 iCloud 同步干扰 node_modules。

## 怎么改

1. 改台词：编辑 `source/voice/lines.json`，然后重新配音：
   `node ~/.claude/skills/promo-video/tts.mjs voice/lines.json public/voice`
   时间线按配音长度自动重排，不用手改秒数。
2. 改画面：编辑 `source/src/Intro.tsx`，每个场景一个组件。
3. 出片：在工作目录运行 `npm i`，再运行 `npm run render`。

## 声音

- 中文旁白：晓晓（zh-CN-XiaoxiaoNeural）。夹马来语单词的两句改用晓晓多语言版。
- 马来语「Apa khabar?」「Jom belajar!」：Yasmin（ms-MY-YasminNeural）。
- 没有背景音乐。发平台时用平台 App 里的音乐，音量压在旁白下面。

## 内容

- 只写个人身份：张静灵（中国传媒大学马来语专业教师）、杨启航（中国传媒大学马来语专业本科生），不以学校名义。
- 小程序界面是按真实页面复刻的演示画面。
