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
