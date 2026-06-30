"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { buildMarkdownSanitizeSchema } from "@/lib/markdownSanitizeSchema";

const markdownSanitizeSchema = buildMarkdownSanitizeSchema(defaultSchema);

const linkComponents: Components = {
  a: ({ node, children, ...props }) => (
    <a target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

interface SafeMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Renders untrusted markdown with GFM and a hardened rehype-sanitize schema.
 * All external links automatically get rel="noopener noreferrer" and target="_blank"
 * to prevent reverse tabnabbing.
 */
export default function SafeMarkdown({ children, className }: SafeMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
        components={linkComponents}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
