import { MarkdownAsync } from "react-markdown";
import { cacheLife } from "next/cache";
import { markdownRehypePlugins } from "@/components/markdown/markdown-plugins";
import { markdownComponents } from "@/components/markdown/markdown-elements";
import {
  markdownRemarkPlugins,
  markdownRemarkRehypeOptions,
  markdownUrlTransform,
} from "@/components/markdown/markdown";
import { markdownProseClassName } from "@/components/markdown/markdown-prose";

type MarkdownContentProps = {
  children: string;
  kind: "regular" | "heartwork";
};

export async function MarkdownContent({ children }: MarkdownContentProps) {
  "use cache";
  cacheLife("max");

  return (
    <div className="@container/markdown-reading min-w-0">
      <div className={markdownProseClassName}>
        <MarkdownAsync
          skipHtml
          remarkPlugins={markdownRemarkPlugins}
          remarkRehypeOptions={markdownRemarkRehypeOptions}
          urlTransform={markdownUrlTransform}
          components={markdownComponents}
          rehypePlugins={markdownRehypePlugins}
        >
          {children}
        </MarkdownAsync>
      </div>
    </div>
  );
}
