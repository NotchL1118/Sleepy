import type { ComponentPropsWithoutRef } from "react";
import type { ExtraProps } from "react-markdown";
import { CodeBlock } from "./CodeBlock";
import { MermaidBlock } from "./MermaidBlock";
import {
  isAllowedMarkdownImageSrc,
  markdownLinkOpensInNewTab,
  markdownLinkRel,
} from "./markdown";

type MarkdownLinkProps = ComponentPropsWithoutRef<"a"> & { node?: unknown };
type MarkdownImageProps = ComponentPropsWithoutRef<"img"> & { node?: unknown };

function withoutNode<T extends { node?: unknown }>(props: T) {
  const rest = { ...props };
  delete rest.node;
  return rest;
}

export function MarkdownLink(props: MarkdownLinkProps) {
  const { href, children, ...anchorProps } = withoutNode(props);
  const opensInNewTab = Boolean(href && markdownLinkOpensInNewTab(href));

  return (
    <a
      {...anchorProps}
      href={href}
      rel={opensInNewTab ? markdownLinkRel(href ?? "") : undefined}
      target={opensInNewTab ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}

export function MarkdownImage(props: MarkdownImageProps) {
  const { alt, src, ...imageProps } = withoutNode(props);
  const imageSrc = typeof src === "string" ? src : undefined;
  if (!imageSrc || !isAllowedMarkdownImageSrc(imageSrc)) return null;

  return (
    // Markdown images use Admin-supplied relative or HTTPS URLs, not the
    // Next.js image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img {...imageProps} alt={alt ?? ""} src={imageSrc} />
  );
}

function MarkdownPre({ node, children, className, style }: ComponentPropsWithoutRef<"pre"> & ExtraProps) {
  const source = String(node?.properties["data-code-source"] ?? "");
  const language = String(node?.properties["data-code-language"] ?? "text");
  if (language === "mermaid") return <MermaidBlock source={source} />;
  return <CodeBlock source={source} language={language}>
    <pre className={className} style={style} tabIndex={0} aria-label={`${language} 代码`}>
      {children}
    </pre>
  </CodeBlock>;
}

function MarkdownTable({ node, ...props }: ComponentPropsWithoutRef<"table"> & ExtraProps) {
  void node;
  return <div data-markdown-table="" tabIndex={0} role="region" aria-label="表格，可横向滚动"><table {...props} /></div>;
}

export const markdownComponents = {
  a: MarkdownLink,
  img: MarkdownImage,
  pre: MarkdownPre,
  table: MarkdownTable,
};
