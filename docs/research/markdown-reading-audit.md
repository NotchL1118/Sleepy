# Sleepy Markdown 阅读体验与 Mermaid 接入调研

日期：2026-09-10。本文保留实施前调研；用户已确认样张并批准实施，最终结果见[实现基线](./markdown-reading-design.md)。
本地调研基线：`93f71d737d99027398fa7ff1efe7e883727b46b4` 的工作区。本文的现状表记录实施前的静态源码审阅；后续样张确认、实现和浏览器验证见[实现基线](./markdown-reading-design.md)。未进行读者实验或性能基准测量。

## 现状及可验证的问题

以下 px 换算假设浏览器根字号为 16px；截图不能用于反推 CSS 像素。

| 项目 | 源码现状 | 设计含义 |
| --- | --- | --- |
| 普通文章正文 | 1.0625rem / 1.8，即约 17px / 30.6px | 正文不算小，不能只靠继续放大解决阅读问题 |
| 普通文章容器 | 最大 57.5rem，即 920px | 按全宽中文粗算约 54 字/行；实际取决于混排及字体 |
| 心作 | 最大 780px；正文约 17.6px / 1.8 | 已存在密度差异，是否统一需明确 |
| 手机正文 | 16px / 1.78；左右各约 18px | 需要在窄屏验证代码和图表局部溢出 |
| 代码块 | 13.12px / 1.75；内边距 20px × 22.4px | 字号比正文小得明显；应独立设置字号、行高和容器间距 |
| 表头 | 11.52px，uppercase，额外字距 | API 名称不宜强制改大小写；表头可提高至接近表格正文 |
| 表格单元格 | 每格最小 144px | 即便内容短，多列表格也会较早横向滚动 |
| 多段引用 | 所有 blockquote p 的 margin 都为 0 | 段与段没有额外垂直间距 |
| 行内代码选择器 | code:not([data-theme]) | Studio 原始代码块中的 code 也会命中，可能出现行内背景、padding 与二次字号缩小 |
| 字体 | Geist、Geist Mono，Latin 子集；中文回退系统字体 | 应在 macOS、Windows 和移动端检查中英混排，不能仅凭单个平台判断 |
| 背景纹理 | 全页固定噪点覆盖层，浅色 opacity 0.28 | 与截图中的纹理相符；可做降低或移除纹理的对照样张，舒适度改善尚未实测 |

来源：[正文样式](../../src/components/markdown/markdown-prose.module.css)、[文章布局](../../src/app/(site)/components/PostContentPage/index.module.css)、[字体](../../src/app/layout.tsx)、[全局样式](../../src/app/globals.css)。

公开文章使用服务端 `MarkdownAsync`、GFM、标题 slug 和双主题代码高亮；Studio 使用客户端同步 Markdown，仅共享 GFM 与正文样式，尚未达到渲染一致。Studio 预览有 180ms 延迟，容器最大 768px。两条流程都没有 Mermaid 渲染分支，依赖中也没有 Mermaid。来源：[公开渲染](../../src/app/(site)/components/PostContentPage/MarkdownContent.tsx)、[预览](../../src/app/(studio)/dashboard/components/MarkdownPreview/index.tsx)、[编辑器](../../src/app/(studio)/dashboard/components/MarkdownEditorField/index.tsx)、[依赖](../../package.json)。

当前公开 Markdown 渲染入口用于普通文章和心作；页面管理显示“尚未接入”。“统一页面内容样式”应明确是共享能力供后续复用，还是新增页面功能；不应默默扩展为页面管理建设。来源：[页面管理](../../src/app/(studio)/dashboard/pages/page.tsx)。

## 可供样张比较的起始参数（设计建议，非人体工学最优值）

先保持站点的无衬线、浅暖底色、克制强调色和深浅主题方向。参考 [视觉约束](../agents/visual-style.md)。

| 内容 | 第一版候选 |
| --- | --- |
| 正文 | 桌面 17–18px，手机 16–17px；行高 1.75–1.85 |
| 正文行宽 | 桌面先比较 680、720、760px；中文约 38–44 字，混排实测 |
| 段落与标题 | 段间约 0.9–1.1em；标题前距大于后距，相邻标题避免空白叠加 |
| 代码 | 14–15px / 1.55–1.65；保留缩进；横向滚动；复制入口；换行是否可切换待定 |
| 表格 | 14–15px，表头不强制 uppercase；按内容分配列宽，容器局部滚动 |
| 图表 | 独立图形容器与字号；大图放大查看，不以无限缩小标签来适应正文 |

已确认：正文、代码、表格、图片与 Mermaid 共用同一内容宽度，左右边缘对齐，不允许块级内容突破正文边界。长代码和宽表格在各自容器内部滚动，大图提供放大查看。具体宽度需连同目录位置、手机布局与 Studio 分栏一起验证。

## Mermaid 官方能力与接入建议

已按仓库要求执行 Context7 `library Mermaid`，解析为 `/mermaid-js/mermaid`，再调用 `docs`，并核对官方网页。

官方提供异步 `mermaid.render(id, source)` 返回 SVG；`startOnLoad: false` 可关闭自动扫描；`parse` 可校验语法；默认 `securityLevel: strict` 限制 HTML 和点击行为。字体加载时机会影响标签测量。[官方 Usage](https://mermaid.js.org/config/usage.html)

官方支持主题配置，自定义主题变量以 `base` 为基础；可通过 `accTitle`、`accDescr` 提供 SVG 的标题、描述及辅助技术关联。[主题](https://mermaid.js.org/config/theming.html)、[无障碍](https://mermaid.js.org/config/accessibility.html)

以下是结合 Sleepy 现状的工程建议，尚未实施：

1. 明确识别 fenced code 的 `mermaid` 语言，在普通语法高亮处理前保留原始源码；不对任意代码内容猜测语言。
2. 继续让正文使用现有服务端渲染；为图表增加独立客户端边界，按需载入 Mermaid。公开内容和 Studio 共用图表行为。具体版本在实施前结合浏览器支持和包体测量决定，不能照抄其他仓库的版本。
3. 保留源码作为加载、失败与无 JavaScript 时的退路；单图失败不阻断整篇文章。Studio 编辑期间避免旧异步渲染结果覆盖新文本。
4. 站点主题切换后按当前主题重新生成 SVG；多图、重复图、快速切换与组件卸载需要唯一 ID、配置隔离/串行调度及过期结果丢弃，不能仅依赖全局一次初始化。
5. 默认展示图形；是否提供源码切换、复制、放大、缩放/平移、SVG 下载由访谈决定。不要把库的渲染能力误当作现成的阅读器交互。
6. 默认保留 strict 与站点受控主题；无需为普通流程图放宽 Markdown 原始 HTML。图内链接或自定义配置若成为明确需求再单独讨论。
7. 优先用截图中的中文流程图，以及时序图、类图/ER 图、多图、无效语法、大图和深浅主题建立验收样本。

如果要求“无 JavaScript 也必须直接看到图形”，则需要另外评估预生成 SVG、字体环境、主题资产及生成缓存；当前尚未确认这一约束。

## 访谈决策树

已确认（2026-09-10）：覆盖公开文章、页面内容、Studio 预览；Mermaid 默认展示图形，支持放大查看、源码切换和复制。

已确认阅读优先级：长文阅读优先，代码和表格适度紧凑。

第二轮已确认：所有正文内容统一宽度，不允许代码或图形向两侧突出；纸张纹理保持原样；代码默认不换行并提供自动换行切换，复制保留原文；首期提供统一默认样式并兼容浏览器缩放，不增加阅读设置。保持当前无衬线和等宽代码字体方向。具体最大宽度尚待样张验证。

第三轮已确认：普通文章与心作暂时共用排版；Studio 预览完整对齐发布效果；页面管理留待后续，页面内容按与普通文章相同的 Markdown 渲染能力准备。

本次应用接入范围为普通文章、心作与 Studio 预览；共享能力供未来页面内容复用。

产品范围与主要取舍已经收敛。用户已确认样张并批准实施，新增点击Mermaid图形本身即可放大的要求。正式实现和验证结果见 [Markdown 阅读体验实现基线](./markdown-reading-design.md)。原型与临时验证页面已按用户要求删除。

Kami 和 W3C 的独立来源调研见 [Kami 阅读体验调研](./kami-markdown-reading.md)。只有在访谈收敛后才把候选参数转为实现决定。
