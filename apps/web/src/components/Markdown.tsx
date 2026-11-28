import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown → React. No `rehype-raw`, so embedded HTML in an imported page is
 * escaped, not executed: stored page text is untrusted.
 *
 * Every block carries the line range it came from in the stored markdown
 * (`data-line-start` / `data-line-end`). That is what lets a citation from the
 * agent scroll the reader to the exact lines — the same lines `read_passage`
 * returns, because both read the same stored text.
 */

function anchor(node: ExtraProps["node"]) {
  const start = node?.position?.start.line;
  const end = node?.position?.end.line;
  if (!start) return {};
  return { "data-line-start": start, "data-line-end": end ?? start };
}

const components: Components = {
  p: ({ node, ...props }) => <p {...anchor(node)} {...props} />,
  h1: ({ node, ...props }) => <h1 {...anchor(node)} {...props} />,
  h2: ({ node, ...props }) => <h2 {...anchor(node)} {...props} />,
  h3: ({ node, ...props }) => <h3 {...anchor(node)} {...props} />,
  h4: ({ node, ...props }) => <h4 {...anchor(node)} {...props} />,
  h5: ({ node, ...props }) => <h5 {...anchor(node)} {...props} />,
  h6: ({ node, ...props }) => <h6 {...anchor(node)} {...props} />,
  li: ({ node, ...props }) => <li {...anchor(node)} {...props} />,
  blockquote: ({ node, ...props }) => <blockquote {...anchor(node)} {...props} />,
  pre: ({ node, ...props }) => <pre {...anchor(node)} {...props} />,
};

export function Markdown({
  children,
  anchors = true,
}: {
  children: string;
  /**
   * Whether blocks carry their source line range. The reader needs it so a
   * citation can scroll to the span; the agent's own answer does not, and must
   * not, or a citation would target the answer instead of the article.
   */
  anchors?: boolean;
}) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={anchors ? components : undefined}>
      {children}
    </ReactMarkdown>
  );
}
