"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { buildMarkdownSanitizeSchema } from "@/lib/markdownSanitizeSchema";
import { rehypeNoPrototypePollution } from "@/lib/rehypeNoPrototypePollution";

const markdownSanitizeSchema = buildMarkdownSanitizeSchema(defaultSchema);

interface SafeMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders untrusted markdown with GFM and a hardened rehype-sanitize schema.
 */
export default function SafeMarkdown({ children, className }: SafeMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema], rehypeNoPrototypePollution]}
        components={{
          a: ({ href, children: linkChildren, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
