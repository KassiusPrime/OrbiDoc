/**
 * Helper utilities for cleaning AI text and removing markdown formatting artifacts (like **asterisks**)
 */

export function cleanAsterisks(text: string): string {
  if (!text) return '';
  return text
    // Replace **bold** with plain text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    // Replace *italic* with plain text
    .replace(/\*(.*?)\*/g, '$1')
    // Replace __bold__ with plain text
    .replace(/__(.*?)__/g, '$1')
    // Replace _italic_ with plain text
    .replace(/_(.*?)_/g, '$1')
    // Clean remaining stray markdown symbols
    .replace(/`{3}[\s\S]*?`{3}/g, (match) => match.replace(/```[a-z]*/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function cleanMarkdownForExport(text: string): string {
  if (!text) return '';
  return text
    .replace(/^#+\s+/gm, '') // Remove heading markers # ## ###
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links [title](url) to title
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/`{3}[a-z]*\n([\s\S]*?)\n`{3}/g, '$1') // Remove code fences
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

/**
 * Optimizes text carriage returns (CR / \r\n), fixes broken line-end hyphenations,
 * trims trailing spaces, and eliminates redundant blank line clusters.
 */
export function optimizeLocalCR(text: string): string {
  if (!text) return '';
  return text
    // Normalize Windows/Mac line endings (\r\n or \r -> \n)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Rejoin words split by line-break hyphenation (e.g. "com-\nputador" -> "computador")
    .replace(/(\w+)-\n([a-zà-úâ-ûã-õä-ü])/gi, '$1$2')
    // Remove trailing spaces on each line
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    // Collapse 3 or more consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

