# Kami 阅读排版与 Mermaid：源码及 W3C 研究

研究日期：2026-09-10。Kami 固定提交：[`4dab24cc4c527dbb35aa8fae09e02822992dfbe2`](https://github.com/tw93/Kami/tree/4dab24cc4c527dbb35aa8fae09e02822992dfbe2)。通过公开网页、固定提交源码核查；未运行渲染、安装依赖或修改应用。未访问 Sleepy 的 `demo/`；本地仅阅读领域和视觉约束，应用现状与 Mermaid 官方 API 由主任务另行研究。

证据标记：**源码事实**指代码中实际声明；**项目自述**指 Kami 文档的设计意图或验证声明；**规范证据**指 W3C 要求；**提议**指供 grilling 与后续试读比较的起点。源码存在某个参数，不等于已经验证它最适合 Sleepy；本文不主张任何范围是“科学证明的最优值”。

## 1. 可以借鉴什么

Kami 是以打印文档为核心的约束系统，同时包含网站样式；其设计文档明确声明自己不是 UI 框架。应分别看网站 `.prose` 和 A4 长文模板，不能把打印参数当作网页 Markdown 默认值。[设计定位](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/references/design.md#L1-L20)

**提议：**借鉴标题前后间距的层级、段落节奏、低装饰表格、行内与块级代码的边界。Sleepy 当前视觉规范要求现代无衬线、中文与拉丁文混排、夜间舒适阅读，因此不直接引入 Kami 的楷体／衬线正文及墨蓝配色。[Sleepy 视觉约束](../agents/visual-style.md)

## 2. 网站与长文模板的实际参数

### 网站正文：更接近屏幕阅读，但不是完整 Markdown 组件

**源码事实：**官网 about 等页面使用 `.prose`。段落和列表为衬线 `16px / 1.65`，段后 `16px`；三级标题 `19px / 1.3`、字重 500、上下距 `30px / 10px`；列表左缩进 `20px`，条目下距 `8px`。行内代码 `13.5px`、左右内边距 `3px`、圆角 `2px`。`.prose` 本身没有独立的阅读宽度上限，不能从这些规则声称 Kami 已实现某个理想行长。[官网正文样式](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/site/styles.css#L907-L983)、[about 页面使用处](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/site/about.html#L60-L80)

官网默认字体链以 Charter、Georgia 开始，中文切到 TsangerJinKai02 与 CJK 衬线回退；这些是品牌选择，不能作为无衬线阅读不佳的证据。[网站字体规则](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/site/styles.css#L40-L63)

### A4 长文：具体值保留原单位，避免误读

下表是中文 `long-doc.html` 的**源码事实**，不是给 Sleepy 的参数表。

| 部位 | 模板实际值 | 来源 |
| --- | --- | --- |
| 页面／屏幕预览宽度 | A4；页边距上20、右22、下22、左22mm；屏幕 body 最大210mm，使用同样内边距，且全局 border-box | [布局](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L34-L95) |
| 正文 | `10.5pt / 1.55`，字距 `0.3pt`；段后 `10pt` | [正文](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L87-L95)、[段落](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L223-L230) |
| 标题 | h1 `22pt / 1.2`，下距10pt；h2 `16pt / 1.25`，上下距24/8pt；h3 `13pt / 1.3`，上下距18/6pt；字重均500 | [标题](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L183-L212) |
| 列表 | 上下距6/10pt，左缩进20pt，行高1.55 | [列表](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L242-L249) |
| 引用 | 外距12pt 16pt，内距4pt 0，行高1.55；没有把所有引用内段落的 margin 清零 | [引用与段落](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L223-L264) |
| 行内代码 | 9pt；浅底；内距1pt 4pt；圆角2pt | [代码](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L266-L295) |
| 代码块 | `9pt / 1.5`；内距10pt 14pt；上下距10pt；圆角4pt；`pre-wrap`；`pre code` 复位背景、内边距和字号 | [代码块](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L281-L295) |
| 表格 | 宽100%，9.5pt，折叠边框；表头500字重、内距6pt 8pt、底线0.6pt；单元格内距5pt 8pt、底线0.25pt；没有强制大写表头或固定单元格最小宽度 | [表格](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L297-L329) |

**计算而非测量：**按 CSS 绝对单位关系，10.5pt = 14 CSS px；210mm 外宽扣去左右44mm，内容宽约627 CSS px。以14px汉字加0.4px字距粗估约43–44个全角字，未计标点、字体实际字面和混排。这是模板上限的换算，不能称为实际屏幕测得的固定行数。[W3C 单位关系](https://www.w3.org/TR/css-values-4/#absolute-lengths)

**项目自述与源码差异：**设计文档的 print Body 档为10pt，长文模板却是10.5pt；设计文档还把1.6以上行高列为打印正文的禁用范围。这里应以具体模板描述“实际使用”，并将打印审美限制留在打印场景，不据此把 Sleepy 的1.8行高判为错误。[字号与行高设计表](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/references/design.md#L134-L193)

英文长文同为10.5pt / 1.55，正文以 Charter、Georgia、Palatino、Times New Roman 回退，没有中文模板的0.3pt字距；代码使用 JetBrains Mono 等等宽链。[英文模板](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc-en.html#L46-L81)

## 3. 代码块与表格能迁移的处理

**源码事实：**代码高亮是构建时 Pygments 处理，生成行内样式；没有语言、未知语言或缺少依赖时保留原 HTML。它体现了高亮可失败而内容仍可读的退化路径。[高亮实现](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/scripts/highlight.py#L119-L166)

**提议：**Sleepy 可借鉴 `pre code` 对行内装饰的独立复位，不应让是否高亮决定基本排版。Kami 的 `pre-wrap` 属于纸张适配选择；网页代码长行究竟换行还是局部横滚，应由代码可读性与读者操作方式决定。本次没有证据表明其中一种对所有代码都更好。

**源码事实：**表格另有 compact、financial、striped 变体：紧凑版缩到8pt，数字列可右对齐并使用等宽数字，斑马纹是可选项。**提议：**借鉴表头与单元格字号接近、细横线和数字对齐；不要把为纸张腾空间的8pt紧凑版搬到网页。宽表、宽图可局部横滚，不能靠把文字无限缩小解决。[表格变体](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/assets/templates/long-doc.html#L318-L329)

## 4. Mermaid 实现与边界

**项目自述／源码事实：**Kami 使用 beautiful-mermaid 生成 SVG，再由纯 Python `mermaid_normalize.py` 改色与处理字体，最终嵌入 HTML 供 WeasyPrint 输出 PDF；Kami 不捆绑该 Node 包。预制 sequence、class、ER 图已经是静态 SVG，可改标签使用。它不是自动将文章中 Mermaid fenced code 转成浏览器图表的现成集成。[Kami 流程说明](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/references/mermaid.md#L3-L65)

| 核查点 | 证据及边界 |
| --- | --- |
| 主题 | 七个颜色角色映射到 Kami 中性色和单一强调色；将 `var()`／`color-mix()` 转为静态颜色，去除字体 import，改成含 CJK 回退的字体链。[转换函数](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/scripts/mermaid_normalize.py#L279-L313) |
| 输入限制 | 要求根 SVG style 中出现 `--bg`、`--fg`，否则报错；源码注明针对 beautiful-mermaid v1.1.3 核查。不能把它称为适配任意官方 Mermaid SVG 的通用转换器。[输入检查](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/scripts/mermaid_normalize.py#L261-L276) |
| 支持范围 | Kami 文档列出 PDF 路径 flowchart、state、sequence、class、ER；浏览器路径另列 xychart。文档将 xychart 的 PDF 限制归因于 WeasyPrint 对 SVG style 类选择器的处理。这是该管线的边界，不是官方 Mermaid 全部能力的清单。[兼容说明](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/references/mermaid.md#L8-L21) |
| 失败行为 | 无法解析的颜色表达式抛错，命令入口输出错误并返回1；不是保证任意 SVG 都能被“修好”。[颜色错误](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/scripts/mermaid_normalize.py#L234-L257)、[退出行为](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/scripts/mermaid_normalize.py#L328-L338) |
| 安全与交互 | `normalize()` 进行字符串样式转换，未实施通用 SVG 标签／属性白名单；不能将它视为安全消毒器。该路径也未提供文章端的动态主题、键盘缩放、错误回退 UI、按需加载与无障碍说明。[函数全文](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/skills/kami/scripts/mermaid_normalize.py#L279-L313) |

**验证范围：**上述兼容成功是 Kami 文档的声明，本研究没有重跑其渲染测试。官方 Mermaid API、渲染时机及安全选项由主任务核查；此处没有追加库 API 查询，避免重复 Context7 工作。

## 5. W3C 支持的是可调与不丢内容，不是唯一最佳字号

下表区分规范等级。Understanding 页面是官方解释材料，规范性条款见 [WCAG 2.2](https://www.w3.org/TR/WCAG22/)。

| 条款 | 规范证据 | 对 Sleepy 的含义 |
| --- | --- | --- |
| 1.4.8 Visual Presentation，AAA | 应有机制让文字块达到不超过80字符／字形（CJK为40）、不两端对齐、至少一倍半行间距及更大段间距等；可以由浏览器提供机制，不强迫这些成为初始样式。[官方解释](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html) | 40个CJK是可访问性目标参考，不是所有读者最佳行长的实验结论；仅有默认宽度超过40字也不能直接判定整站违规。 |
| 1.4.4 Resize Text，AA | 除条款所列例外，文本可放大至200%，内容与功能不丢失。[官方解释](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) | 验收正文、标题、表头与控件放大后是否裁切或重叠；不能只截取100%缩放的漂亮截图。 |
| 1.4.10 Reflow，AA | 纵向内容在等效320 CSS px宽度下不丢信息／功能，不要求二维滚动；1280px视口400%缩放是其示例。对确需二维布局的图和数据表有例外，表格单元格仍需关注回流。[官方解释](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | 正文应回流；图表可有自己的滚动区域，例外不扩展成整个页面随宽图横向溢出。 |
| 1.4.12 Text Spacing，AA | 同时覆盖为行高至少1.5倍字号、段后2倍字号、字距0.12倍、词距0.16倍时，不丢内容或功能；对不适用某项属性的文字系统有例外。[官方解释](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html) | 这是读者覆盖样式的兼容测试，不是要求默认中文正文设置0.12em字距；混排需按适用文字系统检查。 |

## 6. 供 grilling 的试调起点（均为提议）

主任务提供的初步现状：正文桌面17px / 1.8、移动16px / 1.78，普通文章上限920px、心作780px。本研究未重复审计这些值。若按全角字约等于字号粗估，920/17约54字，首先比较行长，比同时更换字体、字号和行高更容易识别原因。

| 维度 | 初始比较范围 | 需要观察的现象 |
| --- | --- | --- |
| 字号与行高 | 桌面17–18px、移动16–17px；行高1.7–1.85 | 用同篇中文长文与技术混排试读；先保留当前17/1.8作为基准，不因 Kami 打印模板而缩小 |
| 正文净宽 | 优先比较约34–40个全角字：17px下约578–680px，18px下约612–720px；英文可另比较60–75个实际字符 | 回行是否容易追踪、长段是否疲劳；这些是粗估，应扣除内边距并检查实际字体，不能用一个固定像素范围同时保证所有字号的字数 |
| 段落与标题 | 段后0.9–1.2em；章节标题上距约1.8–2.4em、下距0.6–0.9em；均按正文尺度讨论 | 段落是否有清晰停顿，标题是否更靠近它引出的内容；这些默认值不等同于AAA条款全部要求 |
| 代码 | 字号14–15px、行高1.55–1.7、内边距14–20px | 中文注释、长命令、缩进与复制是否清楚；局部横滚／换行待选择 |
| 表格 | 表头与正文先试14–16px，单元格上下8–12px，左右10–14px | 长表头是否被过早折断、数字是否易比较；不强制大写或为所有列设置同一最小宽度 |

上述选择受 Sleepy 的留白、无衬线与响应式约束影响；W3C 提供验证边界，没有为这些起点背书。[视觉约束](../agents/visual-style.md)、[响应式约束](../agents/styling.md)

已确认的产品范围：公开文章、页面内容与 Studio 预览；Mermaid 默认显示图形，并提供放大视图、源码切换和复制。Kami 的静态流程不能直接满足这些交互，具体集成由主任务研究。

仍未确认：阅读密度偏好；普通文章和心作是否共用正文宽度；宽代码／表格／Mermaid 是否允许超出正文列；Mermaid 首期必须支持的真实图种及错误状态。后续 grilling 应先辨明主要痛点是回行、字太小还是块间拥挤，避免把本文起点当作已批准参数。选定代表性内容后，比较窄／宽两档，再分别核查200%文本放大、320px回流和文字间距覆盖。本次未实施这些比较，也未下最终设计结论。

## 7. 许可证

**源码事实：**Kami 的代码和模板使用 MIT，版权归属为2026 Tw93；复制或分发软件的重要部分需保留版权和许可声明。[固定提交 LICENSE](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/LICENSE)

**项目自述：**README 对 TsangerJinKai02 单独注明仅个人使用免费、商业使用需向字体方取得许可。不能因仓库代码是 MIT 就把字体当作 MIT 资源；README 对其他系统／开放字体的概述也不是各字体再分发许可的替代。本研究没有独立核验字体厂商合同，因此没有得出可将这些字体部署到 Sleepy 的结论。[字体说明](https://github.com/tw93/Kami/blob/4dab24cc4c527dbb35aa8fae09e02822992dfbe2/README.md#L188-L192)

**提议：**本轮只借鉴布局关系，保留 Sleepy 的字体与主题；如后续实际复制模板代码，随代码保留 MIT 声明；如选择新字体，再核验该字体文件自己的授权。
