import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Notice, type NoticeTone } from './Notice';

const html = (tone: NoticeTone) =>
  renderToString(createElement(Notice, { tone, children: 'texto' }));

describe('Notice', () => {
  it.each(['info', 'success', 'warning'] as const)('announces a %s politely', (tone) => {
    expect(html(tone)).toContain('role="status"');
  });

  it('announces a danger notice as an alert', () => {
    expect(html('danger')).toContain('role="alert"');
  });

  it('shows its content', () => {
    expect(html('info')).toContain('texto');
  });
});
