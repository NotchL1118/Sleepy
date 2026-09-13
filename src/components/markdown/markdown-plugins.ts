import type { Element, Root } from "hast";
import { unified, type Plugin } from "unified";
import { visit } from "unist-util-visit";
import rehypeSlug from "rehype-slug";

// Keep Shiki out of the initial Studio bundle, and use the same configuration
// for the server renderer and the asynchronous Studio preview.
const loadHighlighter = () => import("rehype-pretty-code").then(({ default: prettyCode }) =>
  unified().use(prettyCode, {
    keepBackground: false,
    bypassInlineCode: true,
    defaultLang: "text",
    theme: { light: "github-light", dark: "github-dark-dimmed" },
  }),
);
let highlighter: ReturnType<typeof loadHighlighter> | undefined;

export const rehypeCodeBlocks: Plugin<[], Root> = () => async (tree, file) => {
  const blocks: { element: Element; source: string; language: string }[] = [];
  visit(tree, "element", (element) => {
    if (element.tagName !== "pre") return;
    const code = element.children[0];
    if (code?.type !== "element" || code.tagName !== "code") return;
    const classes = code.properties.className;
    const language = (Array.isArray(classes)
      ? classes.find((name) => typeof name === "string" && name.startsWith("language-"))
      : undefined)?.toString().slice(9).toLowerCase() ?? "text";
    // remark-rehype appends one newline to a code block; remove only that
    // synthetic newline, preserving the original whitespace for copying.
    const source = code.children.map((child) => child.type === "text" ? child.value : "").join("").replace(/\n$/, "");
    blocks.push({ element, source, language });
    // Hide diagrams from the ordinary highlighter, then restore their pre node.
    if (language === "mermaid" || source === "") element.tagName = "div";
  });

  if (blocks.some(({ language, source }) => language !== "mermaid" && source !== "")) {
    try {
      highlighter ??= loadHighlighter();
      const processor = await highlighter;
      await processor.run(tree, file);
    } catch {
      // Network/chunk failures in Studio must not make the article unreadable.
      highlighter = undefined;
    }
  }

  for (const { element, source, language } of blocks) {
    if (language === "mermaid" || source === "") element.tagName = "pre";
    // pretty-code replaces pre with figure; its new pre still needs the raw
    // source because highlighted spans have different whitespace semantics.
    const pre = element.tagName === "figure"
      ? element.children.find((child): child is Element => child.type === "element" && child.tagName === "pre")
      : element;
    if (pre) {
      pre.properties["data-code-source"] = source;
      pre.properties["data-code-language"] = language;
    }
  }
};

export const markdownRehypePlugins = [rehypeSlug, rehypeCodeBlocks];
