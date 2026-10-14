import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StatusDot, type StatusTone } from './StatusDot';

const TONES: StatusTone[] = ['neutral', 'success', 'warning', 'danger'];

describe('StatusDot', () => {
  it.each(TONES)('is a decorative, empty element for the %s tone', (tone) => {
    const html = renderToString(createElement(StatusDot, { tone }));
    expect(html).toMatch(/^<span [^>]*aria-hidden="true"[^>]*><\/span>$/);
    expect(html).not.toMatch(/undefined|null|\[object/);
  });

  it('looks different for each tone, so colour can tell them apart', () => {
    const outputs = TONES.map((tone) => renderToString(createElement(StatusDot, { tone })));
    expect(new Set(outputs).size).toBe(TONES.length);
  });
});
