import assert from "node:assert/strict";
import test from "node:test";
import { MarkdownAsync } from "react-markdown";
import { visit } from "unist-util-visit";
import { markdownRehypePlugins } from "./markdown-plugins.ts";

async function parse(markdown) {
  let tree;
  await MarkdownAsync({
    children: markdown,
    skipHtml: true,
    rehypePlugins: [...markdownRehypePlugins, () => (result) => { tree = result; }],
  });
  const elements = [];
  visit(tree, "element", (element) => { elements.push(element); });
  return elements;
}

test("Mermaid is preserved for the diagram component while neighboring code is highlighted", async () => {
  const source = "flowchart TD\n  A[业务] --> B[适配层]";
  const elements = await parse(`\`\`\`mermaid\n${source}\n\`\`\`\n\n\`\`\`ts\nconst value = 1;\n\`\`\``);
  const blocks = elements.filter((node) => node.tagName === "pre");
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].properties["data-code-source"], source);
  assert.equal(blocks[0].properties["data-code-language"], "mermaid");
  assert.equal(blocks[0].children[0].children[0].type, "text");
  assert.equal(blocks[1].properties["data-code-source"], "const value = 1;");
  assert.ok(elements.some((node) => String(node.properties.style).includes("--shiki-light:")));
  assert.ok(elements.some((node) => String(node.properties.style).includes("--shiki-dark:")));
});

test("copy source retains tabs, trailing spaces and intentional blank lines independently of highlighted spans", async () => {
  const source = "\tconst value = '<tag>';  \n\n";
  const elements = await parse(`\`\`\`js\n${source}\n\`\`\``);
  assert.equal(elements.find((node) => node.tagName === "pre").properties["data-code-source"], source);
});

test("unlabelled, unknown and empty blocks still provide readable code and exact copy source", async () => {
  const elements = await parse("```\nplain <text>\n```\n\n```not-a-language\nx & y\n```\n\n```mermaid\n```\n\n```\n``` ");
  const blocks = elements.filter((node) => node.tagName === "pre");
  assert.deepEqual(blocks.map((node) => node.properties["data-code-source"]), ["plain <text>", "x & y", "", ""]);
  assert.deepEqual(blocks.map((node) => node.properties["data-code-language"]), ["text", "not-a-language", "mermaid", "text"]);
});

test("heading anchors and inline code survive the shared pipeline", async () => {
  const elements = await parse("## 使用方式\n\nRead `adapter.complete()` first.\n\n## 使用方式");
  assert.deepEqual(elements.filter((node) => node.tagName === "h2").map((node) => node.properties.id), ["使用方式", "使用方式-1"]);
  const code = elements.find((node) => node.tagName === "code");
  assert.equal(code.children[0].value, "adapter.complete()");
  assert.equal(code.properties["data-theme"], undefined);
});
