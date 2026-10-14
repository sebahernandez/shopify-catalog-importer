import { describe, expect, it } from 'vitest';
import { ISSUE_CODES, ISSUE_MESSAGES_ES, ISSUE_PARAM_KEYS, renderIssue } from './issue-catalog.js';

const sampleParams = (code: (typeof ISSUE_CODES.options)[number]) =>
  Object.fromEntries(ISSUE_PARAM_KEYS[code].map((key) => [key, `v-${key}`]));

describe('issue catalog', () => {
  it.each(ISSUE_CODES.options)('has a non-empty message and action for %s', (code) => {
    expect(ISSUE_MESSAGES_ES[code].message.length).toBeGreaterThan(0);
    expect(ISSUE_MESSAGES_ES[code].suggestedAction.length).toBeGreaterThan(0);
  });

  it.each(ISSUE_CODES.options)('declares param keys and leaves no placeholder for %s', (code) => {
    expect(ISSUE_PARAM_KEYS[code]).toBeInstanceOf(Array);
    const { message, suggestedAction } = renderIssue(code, sampleParams(code));
    expect(message).not.toContain('{');
    expect(suggestedAction).not.toContain('{');
  });

  it('declares every placeholder a template uses', () => {
    for (const code of ISSUE_CODES.options) {
      const { message, suggestedAction } = ISSUE_MESSAGES_ES[code];
      const used = [...(message + suggestedAction).matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const key of used) expect(ISSUE_PARAM_KEYS[code]).toContain(key);
    }
  });

  it('shows both numbers for DECIMAL-style limits', () => {
    const { message } = renderIssue('ZIP_TOO_MANY_ENTRIES', { limit: 4, actual: 5 });
    expect(message).toContain('4');
    expect(message).toContain('5');
  });

  it('is deterministic for the same input', () => {
    const params = { sheet: 'Variantes', column: 'precio' };
    expect(renderIssue('HEADER_MISSING', params)).toEqual(renderIssue('HEADER_MISSING', params));
  });

  it('ignores undeclared params and blanks missing ones', () => {
    const rendered = renderIssue('HEADER_MISSING', { sheet: 'Variantes', extra: 'x' });
    expect(rendered.message).toContain('Variantes');
    expect(rendered.message).not.toContain('x');
    expect(rendered.message).not.toContain('{');
  });

  it('substitutes a param used twice and does not re-expand injected braces', () => {
    const rendered = renderIssue('HEADER_UNKNOWN', { sheet: '{header}', header: 'notas' });
    expect(rendered.message).toContain('{header}');
  });
});
