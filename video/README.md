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

## 宣传片（横屏，全马来语旁白）2026-11-25

- 成片：`JomBelajar-宣传片-马来语-横屏.mp4`，1920×1080，41 秒，全马来语旁白 + 中文字幕。
- 源码：`source/src/Promo.tsx`（Composition `Promo`），台词 `source/voice/promo/script.json`。
- 画面：小程序白天「旅行手账」版的真实截图（开发者工具模拟器），`source/public/promo/shots/`。
- 声音：ElevenLabs 马来西亚女声 Aisyah（eleven_v3，语言 ms）。密钥只放本机 `ops/elevenlabs.env`，不进仓库。
- 核对：每句配音和整条成片都用语音转写回听过，和台词逐字一致。
- 出片：`npx remotion render Promo out/promo-ms-横屏.mp4`。
