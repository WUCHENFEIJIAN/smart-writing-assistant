import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownResultProps {
  content: string;
}

export function MarkdownResult({ content }: MarkdownResultProps) {
  return (
    <div className="markdown-result" role="document" aria-label="生成结果预览">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, children, ...properties }) => {
            void node;
            return (
              <a {...properties} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          img: ({ node, ...properties }) => {
            void node;
            return <img {...properties} loading="lazy" referrerPolicy="no-referrer" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
