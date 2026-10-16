# 字与心事 · 代码包

全片的画面、动效、文字排版和声音都由这里的代码生成；除字体外不用任何图片、视频或音频素材。本包对应 v4.5（74.3 秒，2230 帧，首尾可无缝循环）。v4.5 重做了片尾最后一秒半（字回字盘：第一句的十二个字和光标先一起躺回片头的输入条，再从最后一个字起一个个跳回前面活字地面上自己的格子；光标和字一起停，之后的声音只跟字），时间快进改成三段（从实时缓缓加速，保持每秒 8 秒——每个 16 分音符跳一秒——再减速到倒数的每拍一秒，不停不跳；棘轮声改成读数每跳一秒一声嘀嗒），全片的中文改为网格排（每个字、每个全角标点各占 1 em 的格子，墨迹居中在中轴上，字形尺寸从字体文件读；同一组的几行共用一张网格；彩蛋代码里的中文一字两列），并改了通读 v4.4 时查出的几处：落字的颜色错误（结果取决于从哪一帧开始渲染）、“红笺小字”入夜时光晕当帧消失、片名定格时歪 0.46°、麻雀落地时往上一跳、时间快进在 23:59:56 停住两秒、00:00:00 那一帧印章是空的、灯火段两扇亮着的窗压在门和柱子上、彩蛋的叮一声早一帧。各版的改动与实测见 `docs/版本迭代与需求变更记录.md`。

## 目录

| 目录 | 内容 |
|---|---|
| `src/` | 影片源代码（Remotion 组织时间线，three.js 画场景，React 叠文字层）。`src/cues.json` 是全片时间表：每个镜头、每个声点的帧号，还有信息栏明暗样式的帧段（`light`）和片尾循环（`loop`）；`src/corpus.ts` 是桃子 35 首诗的录入，与项目里的《桃子诗词稿件》逐字一致 |
| `src/scenes/` | 各段画面：typing 落笔（v4.5：也画字回字盘的后半段，见下）、title 片名、thread 一线（v4.1：鸿雁松线后没有一定次序地离开，两三只一起或一只单独）、inkheart 雀跃（v4.1：麻雀甩在“忐忑”上方的墨点；v4.5：落地时不再往上跳）、spring 南北、clock 更漏（一个全屏光线追踪着色器；v4.3：水滴是正球，快门开每帧 1/8 的真模糊，水面映出水滴、水柱和小水珠；v4.4：穿出水滴的光线和镜头的光线看同一个场景，水滴里是整行倒立的诗句）、Rewrite 聊天顶端那行诗的改写、Chat 聊天记录、moon 月与子正（月光漫开；云在月前聚多、月亮朦胧，钟声后向两边流散；风吹花与雪）、Reply 回信（桃枝和落成句号的桃子）、city 灯火长卷、Ending 片尾、彩蛋与字回字盘的前半段（v4.5：字和光标躺回输入条） |
| `src/lib/` | 公用部分：`ink.ts` 排字（v4.5 网格排：每个全角字占 1 em 的格子，墨迹居中在中轴上，开括号、开引号靠右，闭的靠左；汇文明朝体的字形尺寸读 `src/gen/hw_metrics.json`；每行的两端边界都由它给出：字符按字格，标点按墨迹），`glyph.ts` 的 drawText 和 `textures.ts` 的 glyphCell 用同一套规则，`cityCam.ts` 长卷的镜头，`sparrow.ts` 分件麻雀，`branches.ts` 南北两根枝，`drift.tsx` 飘落的四季意象，`roofs.ts` 子正的屋顶，`post.ts` 三维场景的后期（色调映射、暗角、颗粒），其余为纸、墨、着色器等 |
| `audio/` | 配乐与音效合成（Python）：`synth.py` 乐器，`sfx2.py` 音效，`score_v45.py` v4.5 总谱（就是 v4.4 的，只改两处音效：时间快进的棘轮换成读数每跳一秒一声嘀嗒（时刻由移植过来的同一条时钟曲线 `story_seconds` 解出）；彩蛋的一秒半——叮一声晚一帧，字回字盘的纸声、轻拍和十二声落字；彩蛋倒卷的速度从源码算出，见文件开头），`score_v44.py` v4.4 总谱（用来量母带的响度，见下面第 4 步），`score_v41.py` 及更早的留作对照；`master.sh` 母带 |
| `render/` | 打包、逐帧渲染、预览、编码、检查、打代码包的脚本 |
| `analysis/` | 在渲染出的画面上检查的脚本：`align_v41.py` 气泡的内边距、回执和没发出的半句；`hud_v41.py` 右上角三行；`search_v41.py` 搜索框的居中和拼音后的光标；`visible_blank.py` 字格与看得见的墨迹之间的空白；`continuity_v41.py` 逐帧找跳变（分段渲染接不上的地方）；`grid_v45.py` 网格排：按字体文件和排字规则算出每个字的位置，再在画面上量，逐字列出差值 |
| `tools/` | 网格排字工具（《字体处理规范》第六节）：`gridtype.py` 按影片的排字规则把任意一段文字排好，输出 SVG（字已转成轮廓）、透明底 PNG（`svg2png.mjs`，用 Chromium 栅格化）和每个字位置的报告；给别的软件做图、给图片里的字重排时用 |
| `cover/` | 封面（规范见《文案撰写指南》B 章）。2026-10-17 起是代码画的线画：`lines.tsx` 里三个构思，`ripple`（涟漪，定稿：每 5 px 一圈细线，涟漪的波峰由线的疏密画出，片名由同一组圈线画出，圈线以原半径穿过字）、`gaozhi`（字格，稿纸）、`code`（代码成字，用 `listing.ts` 照片尾彩蛋的分词和配色排出影片的源码）；`measure_ripple.py` 在 PNG 上量字的墨迹、水滴和圈线的位置。`kit.ts` 是几个封面共用的画布、片头的排字（开头的 `T`、`setLine`，走影片的 `lib/ink.ts`）和两倍的画布。`app.tsx` 是封面页和场景表，里面还有 2026-10-13 的四个构思（漏声长、南北月、窗棂月影、活字；漏声长是第一张定稿，2026-10-17 换下）：`clockCover.ts` 由 `make_clock_copy.py` 从影片的 `src/scenes/clock.ts` 复制出来，只换三处：水上的字换成片名、画幅换成 3:4、机位由封面给；`measure.py` 量那几张的字；`plate.mjs`、`make_bundle.py`、`crop.py`、`forme_cut.py` 是活字一稿从影片的帧取画面用的。`shoot.mjs` 按像素比 2 渲染（场景名可以带参数，如 `ripple&cy=950`），`finish.py` 缩成 1080×1440 并出一张卡片大小（180 px 宽）的样子。放在 `src/` 之外：彩蛋显示的是 `src/` 的全部源码，封面的代码放进去会改变彩蛋 |
| `docs/` | 项目文档（v4.5 成片的状态）、版本迭代与需求变更记录（各版的改动与实测）、整体制作指南、文案撰写指南（发布文案与封面）、字体处理规范（网格排、字形尺寸、量法）、诗词稿件副本 |
| `vendor/` | 构建用到的第三方源码快照：Remotion 4.0.534（core、player，commit 6f22950）；three.js r187dev（commit 4551785） |

不包含：汇文明朝体字体文件（约 24 MB，项目文件里有一份，放到 `assets/huiwen.otf`）；渲染出的帧和成片。

## 环境（v4.5 实际使用的版本，与 v3.1、v4.0–v4.4 相同）

- Node 22；npm 包：esbuild 0.28.2、react 与 react-dom 19.2.8、playwright 1.56.0
- Chromium（Playwright 1194 版），用 SwiftShader 软件渲染 WebGL
- Python 3；numpy 2.5.3、scipy 1.18.1；fontTools（打包时 `render/hw_metrics.py` 读字体文件，`analysis/` 也用）、Pillow（`analysis/` 用）
- ffmpeg 6.1（带 libx264、libx265）；zip（打分卷）
- 系统字体：Noto Serif CJK SC、Noto Sans CJK SC、Latin Modern Mono

脚本里写的是原虚拟机的绝对路径：`/home/claude/zxs`（本包）、`/home/claude/vendor`（vendor 目录）、`/opt/npm-tools/node_modules`（esbuild、react、playwright）、`/opt/pw-browsers`（Chromium）。换一台机器时，按同样位置摆放，或者改 `render/build.mjs`、`render/render.mjs`、`render/queue_v44.sh`、`render/chain_v45.sh`、`render/preview_v45.sh`、`render/encode_v45.sh`、`render/verify_final.py`、`render/gen_source.mjs`、`cover/` 里各脚本开头的路径。

## 从代码到成片

1. 打包：`node render/build.mjs`，生成 `out/bundle.js`（同时把源码快照写进 `src/gen/source.json`，片尾和彩蛋里显示的就是它；再跑 `render/hw_metrics.py`，从 `assets/huiwen.otf` 读出源码里每个字的轮廓外框和步进，写进 `src/gen/hw_metrics.json`，排版用它）。再复制一份冻结的：`cp out/bundle.js out/bundle_v45.js`，渲染用这份，渲染途中再改代码、重新打包也不会影响它。注意：彩蛋显示的是全部源码，改任何源文件（连注释）都会改变片尾背后透出的代码、彩蛋和字回字盘开头的画面（第 1971–2196 帧），行数变了，彩蛋倒卷的路程和声音也跟着变（总谱从 `source.json` 算出，所以改了源码要重跑总谱）。
2. 渲染画面：`bash render/chain_v45.sh bundle_v45.js`（参数是 `out/` 里冻结的打包文件），2230 帧 JPEG 写到 `out/full45/`。它按段调用 `render/queue_v44.sh FROM TO bundle_v45.js`（`CH=` 每次开一个浏览器渲多少帧，默认 120）：卡住的段由看门狗结束后自动重试，已渲染的帧跳过，所以中断后重跑就能续上；只补某一段时直接调 `OUT=… CH=… queue_v44.sh FROM TO bundle_v45.js`（先删掉那几帧）。顺序：先渲月亮一段、其余各段，显示源码的第 1965–2184 帧和字回字盘（第 2185–2229 帧，同一个浏览器连续渲出）放在最后：改任何源文件都会改变它们。注意：
   - 月亮成形的一段（第 1115–1225 帧）要在同一次渲染里从第 1115 帧起连续渲完（`chain_v45.sh` 的 `1115 1475` 一段第一次就从 1115 起）；从这一段中间开始渲染，月亮渗开的形状会和连续渲出的不一样（原因没有查明，v4.0 起的成片都是连续渲出的那种）。
   - 其余的画面每一帧只由帧号决定，单独渲某一帧和连续渲出来的应当一样；改代码后可以抽几帧两种渲法逐像素比对（v4.4 片尾落下的字算出了无效的颜色值，浏览器沿用上一帧的颜色，单独从第 2212 帧渲起时字是黑的）。
   - 2 核虚拟机上每帧约 2–10 秒（雀跃、南北、片尾快，开头、一线、子正慢，月亮、更漏每帧约 10 秒），全片约 3–4 小时；只开一个渲染进程（两个同时跑会互相拖慢）。会话空闲时虚拟机会被回收，渲染随之停止，渲染期间要一直有人（或会话）盯着。
3. 预览：`bash render/preview_v45.sh 名字 起始帧 结束帧`，把某一段帧配上母带做成预览 MP4（`out/preview45/`）。
4. 声音：`cd audio && python3 score_v45.py ../src/cues.json ../out/audio/v45_premaster.wav`，再 `MEASURE=../out/audio/v44_premaster.wav bash master.sh ../out/audio/v45_premaster.wav ../out/audio/v45_master.wav`（`MEASURE` 让母带的响度按 v4.4 的总谱量，整体增益与 v4.4 相同；v4.4 的总谱用 `python3 score_v44.py ../src/cues.json ../out/audio/v44_premaster.wav` 生成）（整体 −14 LUFS，真峰值约 −1.2 dBTP）。总谱要在第 1 步打包之后跑：彩蛋倒卷的速度和字回字盘每个字落点的声像，都从 `src/gen/source.json` 读。加环境变量 `STEMS=目录` 会另存各声部的分轨
5. 编码：`bash render/encode_v45.sh`（帧默认取 `out/full45/`，声音默认用 `out/audio/v45_master.wav`；换音轨时设 `AUDIO=` 绝对路径，帧在别处时设 `FRAMES=`，H.265 码率可用 `VB=` 调），在 `out/final45/` 得到高清版（H.264 CRF 15）和单文件版（H.265 两遍编码），高清版另打成 27 MiB 一卷的分卷 zip（`out/final45/hq_zip/`）
6. 检查：`python3 render/verify_final.py all`——帧是否齐全可读，两版成片的时长、响度，H.265 是否小于 29.5 MiB，分卷 zip 拼起来是否与原文件逐字节相同；对齐用 `analysis/` 里的脚本在渲染出的帧上量（用法写在各文件开头）
7. 代码包：`VENDOR_SNAPSHOT=vendor 目录 bash render/package_v45.sh 输出目录`
8. 封面（「涟漪」）：`node cover/build.mjs`（打包成 `out/cover/app.js`）→ `node cover/shoot.mjs ripple out/cover/ripple`（2160×2880 的 `ripple_x2.png`）→ `python3 cover/finish.py out/cover/ripple/ripple_x2.png out/cover/ripple/字与心事_封面.png out/cover/ripple/card.png` → `python3 cover/measure_ripple.py out/cover/ripple/字与心事_封面.png out/cover/ripple/ripple_x2.png`，量出的墨迹应与《文案撰写指南》8.3 一致，圈线在字里字外与算出的半径相差 ±0.05 px 以内。另两个线画把 `ripple` 换成 `gaozhi`、`code`。2026-10-13 的四个构思：先 `python3 cover/make_clock_copy.py`（从影片的 clock.ts 复制出 `cover/clockCover.ts`），再用 `clock`、`window`、`moon`、`forme`（活字一稿先用 `plate.mjs` 渲出第 186 帧的两倍图，再用 `forme_cut.py` 切出印版），量字用 `cover/measure.py`

画面和总谱的时间点主要从 `src/cues.json` 读帧号。也有直接写在代码里的：灯火段每拍亮一扇窗的 13 拍（`city.ts` 的 `BEATS`、`LAST_THREAD`）；信笺飞进窗的那一拍（`cityCam.ts` 的 `FLY`、`JOIN`）；更漏的落水、第七滴停住与镜头推进（`clock.ts` 由 `cues.clock.drips` 算出）；桃子长大、晃、掉、落地、化成句号的帧（`Reply.tsx` 的 `PEACH`，从 `cues.reply` 的帧号加减）；时间快进的曲线（`HUD.tsx` 的 `storySeconds`：三段，分界在 `cues.story.realUntil`、`cues.clock.stop`、`cues.moon.form`、`cues.story.lapseEnd`，最快的速度由这几个时刻和要走完的故事时间解出，现在是每秒 8 秒；总谱 `score_v45.py` 的 `story_seconds` 是同一条曲线，改一处要改另一处）。总谱里各小节的节奏型和笛子旋律多数直接写成 v4.0 的秒数：总谱把时间表换算回 v4.0 的时间（`OLD_CUES`），更漏起的每个声音放进总线时整体推后一拍（`WARP`）。成片的小节：1 秒起两秒一小节；25.0–27.5 是插入一拍后的五拍小节，43.5–45.0 是倒数的三拍小节；其余两秒一小节。调整时间表后，这些要一起核对。

片尾的循环（`cues.loop`，72.83–74.33 s，第 2185–2229 帧）：片尾下面垫着开头的场景，跑到第 −45…−1 帧（`Video.tsx`），所以最后一帧就是片头第 0 帧的前一刻。`cues.loop` 里：`laid`（第 2197 帧）字和光标躺上输入条，`go`、`home` 镜头从拉远回到片头机位的起止，`depart`、`lands` 每个字跳离输入条、落进活字的帧（可以是小数，声音按它放），`fly` 一跳的帧数，`settle` 落地后卡片淡进活字的帧数。第 2185–2196 帧由 `Ending.tsx` 的 `LoopOut` 画（代码页上的字和光标按房间的镜头摆进透视，躺到输入条上），第 2197 帧起由 `typing.ts` 的 `LOOP` 一段画（十二张卡片、活字地面上的空格 `aInk`、镜头、光标）；两边共用 `typing.ts` 导出的 `loopCam`、`LOOP_STRIP`。十二个字的家是 `typing.ts` 的 `LOOP_HOME`（各在自己那一列的正前方）：它也决定片头活字地面上这一句的字在哪里，改它，开头的画面跟着变。

v4.5 整片重渲：`chain_v45.sh` 用 `queue_v44.sh` 渲到 `out/full45/`。更早版本的脚本（v4.1 的 `queue_v41.sh`、`chain_full41.sh`，v4.4 只重渲两段时的 `chain_v44.sh`、`swap_v44.py`，以及各版的 encode、package）在各自的代码包里。
