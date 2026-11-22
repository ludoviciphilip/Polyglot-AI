import { describe, it, expect } from 'vitest';
import React from 'react';
import { interpolate, renderRichText } from './richText';

describe('interpolate', () => {
  it('replaces known placeholders and leaves unknown ones intact', () => {
    expect(interpolate('{count} cards ({rate}%)', { count: 3, rate: 90 })).toBe('3 cards (90%)');
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
  });
});

describe('renderRichText', () => {
  it('turns <strong>/<em> tags into React elements and keeps plain text', () => {
    const nodes = renderRichText('A <strong>bold</strong> and <em>italic</em> end');
    expect(nodes).toHaveLength(5);
    expect(nodes[0]).toBe('A ');
    const strong = nodes[1] as React.ReactElement<{ children: string }>;
    expect(strong.type).toBe('strong');
    expect(strong.props.children).toBe('bold');
    const em = nodes[3] as React.ReactElement<{ children: string }>;
    expect(em.type).toBe('em');
    expect(nodes[4]).toBe(' end');
  });

  it('returns the text as-is when there is no markup', () => {
    expect(renderRichText('plain')).toEqual(['plain']);
  });
});
