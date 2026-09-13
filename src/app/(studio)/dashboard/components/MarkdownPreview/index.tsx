"use client";

import { MarkdownHooks } from "react-markdown";
import { markdownRehypePlugins } from "@/components/markdown/markdown-plugins";
import { markdownComponents } from "@/components/markdown/markdown-elements";
import {
  markdownRemarkPlugins,
  markdownRemarkRehypeOptions,
  markdownUrlTransform,
} from "@/components/markdown/markdown";
import { markdownProseClassName } from "@/components/markdown/markdown-prose";
import type { PostKind } from "@/lib/posts/types";

export function MarkdownPreview({
  markdown,
}: {
  kind: PostKind;
  markdown: string;
}) {
  if (!markdown.trim()) {
    return null;
  }

  return (
    <div className="@container/markdown-reading min-w-0">
      <div className={markdownProseClassName}>
        <MarkdownHooks
          skipHtml
          fallback={<p className="text-sm text-muted" role="status">正在准备预览…</p>}
          rehypePlugins={markdownRehypePlugins}
          remarkPlugins={markdownRemarkPlugins}
          remarkRehypeOptions={markdownRemarkRehypeOptions}
          urlTransform={markdownUrlTransform}
          components={markdownComponents}
        >
          {markdown}
        </MarkdownHooks>
      </div>
    </div>
  );
}
