import { useEffect } from 'react';
import { $getRoot, type TextNode } from 'lexical';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';

export const LEXICAL_FIND_REPLACE_EVENT = 'orbidoc:lexical-find-replace';
export const LEXICAL_FIND_REPLACE_DONE_EVENT = 'orbidoc:lexical-find-replace-done';

export type LexicalFindReplaceDetail = {
  action: 'replace-current' | 'replace-all';
  find: string;
  replace: string;
  caseSensitive: boolean;
  occurrenceIndex?: number;
};

type Match = { node: TextNode; start: number };

function collectMatches(find: string, caseSensitive: boolean): Match[] {
  if (!find) return [];
  const target = caseSensitive ? find : find.toLocaleLowerCase('pt-BR');
  const matches: Match[] = [];
  for (const node of $getRoot().getAllTextNodes()) {
    const original = node.getTextContent();
    const source = caseSensitive ? original : original.toLocaleLowerCase('pt-BR');
    let from = 0;
    while (from <= source.length - target.length) {
      const index = source.indexOf(target, from);
      if (index < 0) break;
      matches.push({ node, start: index });
      from = index + Math.max(1, find.length);
    }
  }
  return matches;
}

export function LexicalFindReplacePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<LexicalFindReplaceDetail>).detail;
      if (!detail?.find) return;
      let replaced = 0;
      editor.update(() => {
        const matches = collectMatches(detail.find, detail.caseSensitive);
        if (detail.action === 'replace-current') {
          const index = Math.max(0, Math.min(matches.length - 1, detail.occurrenceIndex ?? 0));
          const match = matches[index];
          if (match) {
            match.node.spliceText(match.start, detail.find.length, detail.replace, true);
            replaced = 1;
          }
          return;
        }

        // Replace from the end so offsets in a text node remain stable.
        for (const match of [...matches].reverse()) {
          match.node.spliceText(match.start, detail.find.length, detail.replace, false);
          replaced += 1;
        }
      });
      window.dispatchEvent(new CustomEvent(LEXICAL_FIND_REPLACE_DONE_EVENT, { detail: { replaced } }));
    };

    window.addEventListener(LEXICAL_FIND_REPLACE_EVENT, handler as EventListener);
    return () => window.removeEventListener(LEXICAL_FIND_REPLACE_EVENT, handler as EventListener);
  }, [editor]);

  return null;
}
