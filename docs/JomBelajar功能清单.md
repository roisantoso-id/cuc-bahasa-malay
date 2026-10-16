# JomBelajar 功能清单（2026-10-16 从仓库同步）

来源：
- 仓库：https://github.com/Bahari-hash/JomBelajar
- 线上：https://www.bahasa.cn

本文是小程序的对接依据。小程序是 JomBelajar 后端的一个新客户端，**不另建后端**。

## 一、系统组成

| 部分 | 技术 | 说明 |
|---|---|---|
| 后端 `server/TinyLang` | C# .NET minimal API | 所有接口都在 `/api` 下。PostgreSQL + Redis + RabbitMQ（音视频转码、发邮件）+ MinIO（文件存储） |
| 学生端 `app/` | React + DaisyUI | 必须登录才能用 |
| 管理后台 `admin/` | React | 只有管理员能登录 |
| 部署 | GitHub Actions | 推送到 `master` 后，通过 SSH 登录服务器执行 `docker compose up` |

**注意**：`server/TinyLang/appsettings.Development.json` 里明文提交了数据库、JWT、邮箱、MinIO 的密钥，建议维护人更换。

## 二、学生端功能（小程序要全部覆盖）

### 登录和账号
- **登录**：邮箱 + 密码。
- **注册**：邮箱 → 发验证码（6 位数字，60 秒后才能重发，15 分钟内有效）→ 设密码（至少 8 位）。
- **忘记密码**：邮箱验证码 + 新密码。
- **个人资料**：昵称（最多 60 字）、头像（png/jpg/gif/webp，不超过 5MB）、简介（最多 500 字）。
- **账户安全**：修改邮箱、重置密码（成功后所有设备都要重新登录）、删除账号（需要验证码，删除后资料匿名化）。
- **目前没有微信登录。**

### 单词（核心功能）
**单词首页**
- 统计：待复习 N 个、今日已学习 N 个、累计学习 N 个。
- 按钮「开始学习 / 继续学习」。
- 都学完时显示：「当前学习已完成，没有到期复习或待学新词。」

**学习打卡**
- 完成当天的新词学习就算打卡。
- 月历按周一开头。
- 显示当前连续天数、最长连续天数、累计打卡天数。

**今日回顾**
- 列出今天新学和复习过的词。
- 每条有标签（今日新学 / 今日复习）、发音、收藏、释义和例句。

**一组学习**
- 同一个页面既跑新学也跑复习。
- 怎么选组：有进行中的组就接着学；否则先学到期复习的；再没有就学新词。

1. **记忆阶段**
   - 先只看单词和发音，提示「先回忆它的含义，再显示答案。」
   - 点「显示答案」，显示词性、释义、用法和例句（例句带发音和翻译）。
   - 再打分：**重来 / 困难 / 良好 / 简单**。每个按钮上方显示下次复习的间隔，由服务器算好。
   - 复习的组可以点「不再复习此词」，把这个词移出复习。
2. **小结**
   - 显示完成多少个词、各评分各几次。
   - 按钮「确认，进入拼写」或「跳过拼写，完成本组」。
3. **拼写阶段**（可跳过）
   - 只显示释义，让学生拼出单词。
   - 按钮「提交拼写」，输入框空着时变成「不知道，跳过」。
   - 拼错的词会排回队列再练。
4. **完成**
   - 显示完成、排除、跳过各几个。
   - 按钮「继续学习」（再开一组）或「返回单词首页」。

**记忆算法 FSRS-6**
- 学习步长 1 分钟、10 分钟。
- 目标记忆保持率可以设，范围 70–97%，默认 90%。

**设置**
- 每组新词数：1–100，默认 20。
- 每组复习数：1–200，默认 50。

**收藏本、已停止复习的词**
- 在个人资料里打开。
- 停止复习的词可以恢复，恢复后 1 天后重新到期。

### 文章
- **列表**：搜索（标题、摘要）、分类筛选（「更多分类」可以搜索分类）、分页。
- **卡片**：封面、分类、标题、摘要、作者（没有就显示「JomBelajar 编辑」）、日期。
- **详情**：
  - 正文是服务器生成的 HTML；
  - 有朗读录音时显示「文章朗读」播放条（播放 / 暂停、拖动进度）。
- **没有点词查词功能。**

### 视频
- 列表和文章一样，卡片多一个时长。
- 播放 HLS（m3u8），自动从上次看到的位置继续。
- **进度上报**：每 15 秒一次，且位置变化不少于 5 秒才报；暂停、播放结束、离开页面时都会报。
- **算看完**：看到 90% 以上，或者剩下不到 30 秒。

### 在线测试
- **试卷列表**：搜索、分类、显示「N 题 / 总分 / 及格分」。
- **试卷详情**：考试说明 +「开始测试」。如果有没做完的作答，会接着做。
- **答题**
  - 题型：单选、判断（正确 / 错误）、填空、听写（带音频，一题有多个空）。
  - 题目目录显示每题状态：未作答 / 保存中 / 已保存 / 保存失败。
  - 自动保存：停止输入 400ms 后保存，离开输入框时也保存；清空答案就删除这题的作答。
  - 提交时如果还有没做的题，弹窗「还有 k 题未作答，未作答题会按错误计分。确认现在提交吗？」
- **结果**：分数、通过 / 未通过；逐题显示对错、得分、你的答案、正确答案、解析。可以「再做一次」。
- **错题本**
  - 答错和没作答的题自动收进来；分「待掌握 / 已掌握」两栏。
  - 「重做此题」：做对了就移到已掌握，做错了留在待掌握。

## 三、管理后台功能（老师在这里录内容）

| 模块 | 能做什么 |
|---|---|
| 单词 | 增删改；词条、发音录音、多个义项（词性、释义、用法）、例句（句子、翻译、录音）、排序；可以 JSON 批量导入（先试运行检查） |
| 音频库 | 上传、试听、改名、重新上传、删除；按状态筛选 |
| 文章 | 富文本正文、封面、分类、朗读录音（从音频库选）；草稿、发布、下架、归档；预览 |
| 视频 | 断点续传上传、自动转码成 480p / 720p / 1080p 的 HLS；封面、分类、发布 / 下架 |
| 试卷 | 四种题型、分值、解析、及格线、分类；发布前检查；JSON 批量导入（有一条出错就整批不导入） |
| 分类 | 文章、视频、试卷各有一套分类管理 |
| 用户 | 查看列表、按条件筛选 |
| 工作台、系统设置 | 还是空页面 |

## 四、接口要点（小程序对接用）

### 通用约定
- **基础地址**：`https://www.bahasa.cn/api`。
- **字段和格式**
  - 字段名是 camelCase。
  - 枚举传字符串，大小写要和名字完全一致（例如 `Good`），**不能传数字**。
  - ID 是 GUID 字符串；时间是 ISO-8601。
- **分页**
  - 请求：`page`（从 1 开始）、`pageSize`（1–100，默认 20）。
  - 返回：`{items, page, pageSize, totalCount, totalPages}`。
- **登录状态**
  - 访问令牌：JWT，15 分钟有效，放在 `Authorization: Bearer` 头里。
  - 刷新令牌：7 天有效，**只通过 httpOnly cookie `tiny-lang.refresh` 下发**（`Path=/api/auth`）。`/auth/refresh` 和 `/auth/logout` 只从 cookie 里读它。
  - 小程序现在的应对：从返回头 `Set-Cookie` 里取出刷新令牌存起来，刷新时手动带上 `Cookie` 头。正式方案需要后端改（见第六节）。
- **错误格式**
  - 一般错误：ProblemDetails，`{title, status, detail(中文提示), errorCode, errors}`，按 `errorCode` 判断是哪种错误。
  - 令牌失效：401，返回内容为空。
  - 请求太频繁：429，`{code:429, message, retryAfter}`。
- **限流**（每人每分钟）：视频播放地址 30 次、视频进度 120 次、音频播放地址 60 次、上传签名 5 次。
- **文件地址**
  - 封面、头像、文章图片、视频 m3u8：MinIO 公开地址 `https://{MINIO_DOMAIN}/{bucket}/...`。
  - 音频：每次播放前调 `POST /audio/{id}/playback`，拿到一个 **5 分钟有效** 的 mp3 签名地址。
- **「天」按 UTC 算**：打卡和今日回顾在北京时间早上 8 点才换日。

### 接口列表（都要登录，除非注明）

| 模块 | 方法和路径 | 说明 |
|---|---|---|
| 登录 | POST `/auth/login` `{email,password}` | 不用登录。返回 `{token, expiresIn, user}`，同时下发 Set-Cookie |
| | POST `/auth/register-token` `{email}`、POST `/auth/register` `{email,password,verificationCode}` | 不用登录。注册成功后要再登录一次 |
| | POST `/auth/forgot-password-token`、PUT `/auth/forgot-password` | 不用登录 |
| | POST `/auth/refresh`、POST `/auth/logout` | 靠 cookie |
| | POST `/auth/reset-password-token`、`/auth/change-email-token`、`/auth/delete-account-token` | 发验证码 |
| 我的 | GET / PUT `/users/me`、`/users/me/profile` | `{nickname, avatarMediaResourceId, bio}` |
| | GET / PUT `/users/me/word-study-settings` | `{dailyWordStudyCount, dailyWordReviewCount, desiredRetention}`。**PUT 必须三个字段都传**，漏了会被重置 |
| | PUT `/users/me/reset-password`、`/users/me/change-email`；DELETE `/users/me/delete-account` | 都要带验证码 |
| | 上传头像，四步：① POST `/uploads/users/avatar/presign`；② 用 PUT 把文件原始二进制传到签名地址；③ PUT `/uploads/resources/{id}/confirm`；④ 用资源 ID 更新资料 | 小程序第 ② 步用 `wx.request` 发 PUT，不能用 `uploadFile` |
| 收藏 | GET `/users/me/word-favorites`、PUT / DELETE `/users/me/word-favorites/{wordId}` | |
| 停止复习 | GET `/users/me/word-review-exclusions`、DELETE `…/{wordId}` | DELETE 是恢复复习 |
| 单词学习 | GET `/word-study/learning/overview` | `{totalLearnedCount, todayLearnedCount, hasMoreWords, activeSession}` |
| | GET `/word-study/review/overview` | `{dueCount, overdueCount, activeSession}` |
| | POST `/word-study/{learning\|review}/sessions` | 开一组，有进行中的就返回那一组。没词可学时返回 409 |
| | GET `…/sessions/{id}` | 当前状态，结构见下 |
| | POST `…/sessions/{id}/items/{itemId}/memorization` `{result, itemConcurrencyStamp}` | 记忆打分 |
| | POST `…/items/{itemId}/spelling` `{answer, skip, itemConcurrencyStamp}` | 跳过也要传 `answer:""` |
| | POST `/word-study/review/sessions/{id}/items/{itemId}/exclude` | 不再复习此词，只有复习组能用 |
| | POST `…/sessions/{id}/summary` `{skipSpelling}`；POST `…/spelling`；POST `/word-study/learning/sessions/{id}/more` | 换阶段；再加一批新词 |
| | GET `…/sessions/{id}/results` | 本组每个词的结果 |
| | GET `/word-study/review/today`、GET `/word-study/check-ins?year&month` | 今日回顾、打卡 |
| 单词 | GET `/words`、GET `/words/{id}` | 学生网页端没用到这两个接口 |
| 文章 | GET `/articles?categoryId&keyword`、GET `/articles/{id}`、GET `/article-categories` | 详情里正文字段是 `contentHtml`，朗读录音是 `readingAudioResourceId` |
| 视频 | GET `/videos`、GET `/videos/{id}`、POST `/videos/{id}/playback`、PUT `/videos/{id}/progress` `{positionSeconds}`、GET `/video-categories` | `playback` 返回 `{masterPlaylistUrl, positionSeconds, …}` |
| 音频 | POST `/audio/{id}/playback` | 返回 `{url, expiresAt, durationSeconds}` |
| 试卷 | GET `/papers`、`/papers/{id}`、`/paper-categories` | |
| | POST `/papers/{id}/attempts` | 新开返回 201，接着上次的返回 200 |
| | GET `/paper-attempts/{id}`；PUT / DELETE `…/answers/{questionId}`；POST `…/submit`；GET `…/result` | 每题只传一种答案：`selectedOptionId` / `booleanAnswer` / `textAnswer` / `textAnswers[]` |
| 错题 | GET `/paper-wrong-questions?status=Pending\|Mastered`、GET `…/{id}`、POST `…/{id}/redo` | |

**一组学习的状态结构**

- 返回字段：`{id, sessionType, phase, status, actualCount, completedCount, excludedCount, skippedCount, newCount, learningCount, reviewCount, currentItem, summary}`。
- `currentItem` 有两种：
  - 记忆阶段：`{phase:'Memorization', itemId, itemConcurrencyStamp, isFavorite, memorization:{headword, senses[], audioResourceId, ratingPreviews:[{rating, intervalSeconds}]}}`；
  - 拼写阶段：`{phase:'Spelling', …, spelling:{senses:[{partOfSpeech, definition}]}}`。
- **每次操作都要带最新的 `itemConcurrencyStamp`**，否则返回 409。

**枚举值**

| 枚举 | 取值 |
|---|---|
| 学习阶段 | `Memorization` / `Spelling` / `Summary` |
| 组的状态 | `Active` / `Completed` |
| 记忆打分 | `Again` / `Hard` / `Good` / `Easy` |
| 题型 | `SingleChoice` / `TrueFalse` / `FillBlank` / `Dictation` |
| 作答状态 | `InProgress` / `Submitted` |
| 错题状态 | `Pending` / `Mastered` |
| 词性 | `Noun` / `Verb` / `Adjective` / `Adverb` / `Pronoun` / `Determiner` / `Preposition` / `Conjunction` / `Interjection` / `Numeral` / `Particle` / `Other` |

## 五、文案

小程序沿用学生网页端的原文：

| 场景 | 文案 |
|---|---|
| 单词学习 | 开始学习 / 继续学习 · 显示答案 · 重来 / 困难 / 良好 / 简单 · 确认，进入拼写 / 跳过拼写，完成本组 · 提交拼写 / 不知道，跳过 · 下一词 / 查看结果 · 本组已完成 · 不再复习此词 · 收藏 / 取消收藏 |
| 在线测试 | 开始测试 · 提交试卷 · 确认提交 / 继续答题 · 上一题 / 下一题 · 再做一次 · 重做此题 · 待掌握 / 已掌握 |
| 题型 | 单选题 / 判断题 / 填空题 / 听写题 |
| 通用 | 重新加载 · 加载失败，请重试。 · 清除筛选 · 发送验证码 / {n}s 后重发 |

## 六、要接小程序，后端还缺什么

1. **微信登录**：新增 `POST /auth/wechat {code}`，服务器用 `code2session` 换 openid。需要做的：
   - `User` 表加 `WeChatOpenId` 字段；
   - 邮箱改成可以不填，或者首次登录后再绑定邮箱；
   - 小程序的 AppSecret 只放在服务器上。
2. **刷新令牌不走 cookie**：给非浏览器客户端在返回里直接带上刷新令牌，`/auth/refresh` 也能从请求体或请求头读取。
3. **两种起点**（零基础 / 会说一些）：现在没有这个概念。可以用分类来区分，或者在单词、试卷上加「路线」字段。
