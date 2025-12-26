import { marked } from "marked";
import type { Tokens } from "marked";
import { memo, useMemo } from "react";
import { Streamdown } from "streamdown";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  let processedMarkdown = markdown;
  
  // If there are no newlines at all but the text is long, it might be lyrics without formatting
  // Try to intelligently add newlines based on common lyric patterns
  if (!markdown.includes('\n') && markdown.length > 50) {
    processedMarkdown = markdown
      // Add newline before section markers like [Verse], [Chorus], etc.
      .replace(/(\[(?:Verse|Chorus|Bridge|Outro|Intro|Pre-Chorus)\s*\d*\])/gi, '\n\n$1\n')
      // Add newline after sentence endings (period, exclamation, question) followed by capital letters
      // This helps break up verses that run together
      .replace(/([.!?])\s+([A-Z][a-z])/g, '$1\n$2')
      // For lyrics that might have lines separated by capital letters at start of "sentences"
      // Look for patterns like "word. Capital" which might be line breaks
      .replace(/([a-z])\s+([A-Z][a-z]{2,}\s)/g, '$1\n$2');
  }
  
  // Convert single newlines to markdown line breaks (two spaces + newline)
  // This preserves line breaks in song lyrics and plain text
  // But don't convert if it's already a double newline (paragraph break)
  const normalizedMarkdown = processedMarkdown.replace(/([^\n])\n(?!\n)/g, '$1  \n');
  const tokens: TokensList = marked.lexer(normalizedMarkdown);
  return tokens.map((token: Tokens.Generic) => token.raw);
}

type TokensList = Array<Tokens.Generic & { raw: string }>;

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => (
    <div className="markdown-body">
      <Streamdown>{content}</Streamdown>
    </div>
  ),
  (prevProps, nextProps) => prevProps.content === nextProps.content
);

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = memo(
  ({ content, id }: { content: string; id: string }) => {
    const blocks = useMemo(() => parseMarkdownIntoBlocks(content), [content]);
    return blocks.map((block, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: immutable index
      <MemoizedMarkdownBlock content={block} key={`${id}-block_${index}`} />
    ));
  }
);

MemoizedMarkdown.displayName = "MemoizedMarkdown";
