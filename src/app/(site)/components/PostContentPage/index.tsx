import { SiteLink as Link } from "../SiteLink";
import { MarkdownContent } from "./MarkdownContent";
import { TableOfContents } from "./TableOfContents";
import {
  estimateReadingMinutes,
  extractPostHeadings,
  postGroupLabel,
  postPath,
} from "@/lib/posts/content";
import type { AdjacentPost, PostPageData } from "@/lib/posts/types";
import styles from "./index.module.css";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "long",
  timeZone: "Asia/Shanghai",
});

function AdjacentLink({ direction, post }: { direction: "previous" | "next"; post: AdjacentPost }) {
  return (
    <Link href={postPath(post)} className={direction === "next" ? styles.nextPost : undefined}>
      <span>
        {direction === "previous" ? "上一篇" : "下一篇"} · {post.group.name}
      </span>
      <strong>{post.title}</strong>
    </Link>
  );
}

export async function PostContentPage({ page }: { page: PostPageData }) {
  const { post, previousPost, nextPost } = page;
  const headings = extractPostHeadings(post.bodyMarkdown);
  const readingMinutes = estimateReadingMinutes(post.bodyMarkdown);
  const readingClass = post.kind === "heartwork" ? styles.heartworkReading : styles.regularReading;
  const hasDistinctUpdate = post.updatedAt !== post.publishedAt;

  return (
    <main className="pb-36 pt-8 sm:pt-10 min-[821px]:pt-12">
      <article>
        <header className={`${styles.articleHeader} ${readingClass}`}>
          <h1 className={styles.articleTitle}>{post.title}</h1>
          <div className={styles.metadata}>
            <span>
              {postGroupLabel(post.kind)}：{post.group.name}
            </span>
            <span>
              发布于 <time dateTime={post.publishedAt}>{dateFormatter.format(new Date(post.publishedAt))}</time>
            </span>
            {hasDistinctUpdate ? (
              <span>
                更新于 <time dateTime={post.updatedAt}>{dateFormatter.format(new Date(post.updatedAt))}</time>
              </span>
            ) : null}
            <span>{readingMinutes} 分钟阅读</span>
            {post.tags.length > 0 ? (
              <span className={styles.metadataTags}>{post.tags.map((tag) => `#${tag}`).join("　")}</span>
            ) : null}
          </div>
          {post.status === "archived" ? (
            <p className={styles.archiveNotice}>
              <strong>这篇文章已归档：</strong>
              {post.archiveNote ?? "部分内容可能已经过时。"}
            </p>
          ) : null}
        </header>

        <div className={`${styles.reading} ${readingClass}`}>
          <TableOfContents headings={headings} />
          {post.summary ? (
            <aside className={styles.summary} aria-label="文章摘要">
              <strong>摘要</strong>
              <p>{post.summary}</p>
            </aside>
          ) : null}
          <MarkdownContent kind={post.kind}>{post.bodyMarkdown}</MarkdownContent>

          {previousPost || nextPost ? (
            <nav className={styles.adjacentPosts} aria-label="相邻文章">
              {previousPost ? <AdjacentLink direction="previous" post={previousPost} /> : <span />}
              {nextPost ? <AdjacentLink direction="next" post={nextPost} /> : <span />}
            </nav>
          ) : null}
        </div>
      </article>
    </main>
  );
}
