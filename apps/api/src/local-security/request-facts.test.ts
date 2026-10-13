import { describe, expect, it } from 'vitest';
import { requestFactsFrom } from './request-facts.js';

describe('requestFactsFrom', () => {
  it('reads the method and the three headers from the raw header list', () => {
    expect(
      requestFactsFrom({
        method: 'POST',
        rawHeaders: [
          'Host',
          '127.0.0.1:3000',
          'Origin',
          'http://localhost:5173',
          'Sec-Fetch-Site',
          'same-site',
          'Content-Type',
          'application/json',
        ],
      }),
    ).toEqual({
      method: 'POST',
      host: '127.0.0.1:3000',
      origin: 'http://localhost:5173',
      secFetchSite: 'same-site',
    });
  });

  it('reports an absent header as undefined, not as an empty string', () => {
    expect(requestFactsFrom({ method: 'GET', rawHeaders: ['Accept', '*/*'] })).toEqual({
      method: 'GET',
      host: undefined,
      origin: undefined,
      secFetchSite: undefined,
    });
  });

  it('keeps an empty value as an empty string, so it is present and wrong', () => {
    const facts = requestFactsFrom({ method: 'POST', rawHeaders: ['Origin', ''] });
    expect(facts.origin).toBe('');
  });

  it('matches header names without regard to case', () => {
    const facts = requestFactsFrom({
      method: 'POST',
      rawHeaders: ['HOST', 'a', 'oRiGiN', 'b', 'sec-fetch-site', 'c'],
    });
    expect([facts.host, facts.origin, facts.secFetchSite]).toEqual(['a', 'b', 'c']);
  });

  it('returns every value, in order, of a header that was sent more than once', () => {
    const facts = requestFactsFrom({
      method: 'POST',
      rawHeaders: [
        'Origin',
        'http://localhost:5173',
        'Host',
        'h',
        'origin',
        'https://evil.example',
      ],
    });
    expect(facts.origin).toEqual(['http://localhost:5173', 'https://evil.example']);
    expect(facts.host).toBe('h');
  });

  it('does not treat a header value as a header name', () => {
    // Names sit at even positions: an odd position that spells "origin" is a value.
    const facts = requestFactsFrom({
      method: 'POST',
      rawHeaders: ['X-Note', 'origin', 'Host', 'h'],
    });
    expect(facts.origin).toBeUndefined();
    expect(facts.host).toBe('h');
  });

  it.each([
    ['no raw header list', undefined],
    ['a raw header list that is not an array', 'Host: x'],
    ['a raw header list with a dangling name', ['Host']],
    ['a raw header list with a non-string entry', ['Host', 7]],
  ])('throws on %s, so the guard can fail closed', (_label, rawHeaders) => {
    expect(() => requestFactsFrom({ method: 'GET', rawHeaders })).toThrowError(
      /^Local request guard: the request headers are unreadable\.$/,
    );
  });

  it('throws on a method that is not a string', () => {
    expect(() => requestFactsFrom({ method: 7, rawHeaders: [] })).toThrowError(
      /^Local request guard: the request headers are unreadable\.$/,
    );
  });
});
