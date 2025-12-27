import { marked } from "marked";
import type { Tokens } from "marked";
import { memo, useMemo } from "react";
import { Streamdown } from "streamdown";

function parseMarkdownIntoBlocks(markdown: string): string[] {
  let processedMarkdown = markdown;
  
  // Detect if this looks like song lyrics (has section markers or patterns)
  const hasSectionMarkers = /(?:\[?(?:Verse|Chorus|Bridge|Outro|Intro|Pre-Chorus)\s*\d*:?\]?)/gi.test(markdown);
  const hasFewNewlines = (markdown.match(/\n/g) || []).length < 5 && markdown.length > 100;
  const looksLikeLyrics = hasSectionMarkers || (hasFewNewlines && markdown.length > 100);
  
  // If it looks like lyrics but is poorly formatted, fix it
  if (looksLikeLyrics) {
    processedMarkdown = processedMarkdown
      // First, ensure section markers have newlines before them (with or without brackets)
      .replace(/([^\n])(\[?(?:Verse|Chorus|Bridge|Outro|Intro|Pre-Chorus)\s*\d*:?\]?)/gi, '$1\n\n$2')
      // Ensure proper spacing after section markers (add newline if missing)
      .replace(/(\[?(?:Verse|Chorus|Bridge|Outro|Intro|Pre-Chorus)\s*\d*:?\]?)([^\n])/gi, '$1\n$2')
      // Add newline after sentence endings (period, exclamation, question) followed by capital letters
      // This helps break up verses that run together
      .replace(/([.!?])\s+([A-Z][a-z])/g, '$1\n$2')
      // For lyrics that might have lines separated by capital letters at start of "sentences"
      // Look for patterns like "word. Capital" which might be line breaks
      .replace(/([a-z])\s+([A-Z][a-z]{2,}\s)/g, '$1\n$2')
      // Clean up multiple consecutive newlines (more than 2)
      .replace(/\n{3,}/g, '\n\n')
      // Trim leading/trailing whitespace from each line
      .split('\n')
      .map(line => line.trim())
      .join('\n');
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
