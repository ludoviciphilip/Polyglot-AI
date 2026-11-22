import React from 'react';

/**
 * Replaces `{name}` placeholders in a translated string with the given values.
 * Unknown placeholders are left untouched.
 */
export const interpolate = (
  template: string,
  vars: Record<string, string | number> = {}
): string =>
  template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );

/**
 * Renders a translated string that may contain simple, non-nested
 * `<strong>…</strong>` and `<em>…</em>` tags as React nodes (no innerHTML).
 */
export const renderRichText = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  const tagRegex = /<(strong|em)>([\s\S]*?)<\/\1>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = tagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const Tag = match[1] as 'strong' | 'em';
    nodes.push(<Tag key={key++}>{match[2]}</Tag>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};
