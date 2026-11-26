import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Markdown → React. No `rehype-raw`, so embedded HTML in an imported page is
 * escaped, not executed: stored page text is untrusted.
 */
export function Markdown({ children }: { children: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
}
