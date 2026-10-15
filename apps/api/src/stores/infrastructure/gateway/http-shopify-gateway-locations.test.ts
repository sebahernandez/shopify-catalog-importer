import { describe, expect, it } from 'vitest';
import {
  emptyLocationsBody,
  inactiveMixBody,
  location,
  locationsPage,
  pagedLocations,
  threeActiveBody,
} from '../../test-support/fixtures/locations.js';
import { accessDenied200Body } from '../../test-support/fixtures/error-bodies.js';
import { connectionFor, gatewayOver, okStep } from '../../test-support/gateway-test-helpers.js';

const connection = connectionFor('mystore.myshopify.com', 'token');
const list = (bodies: unknown[]) => {
  const { gateway, calls } = gatewayOver(bodies.map((b) => okStep(b)));
  return { run: () => gateway.listLocations(connection), calls };
};

describe('listLocations', () => {
  it('returns 3 active locations untruncated', async () => {
    const { value } = await list([threeActiveBody]).run();
    expect(value.locations).toHaveLength(3);
    expect(value.truncated).toBe(false);
  });

  it('returns exactly 250 untruncated', async () => {
    const { value } = await list(pagedLocations(250)).run();
    expect(value).toMatchObject({ truncated: false });
    expect(value.locations).toHaveLength(250);
  });

  it('returns 250 and truncated for 251, stopping once 251 are seen', async () => {
    const pages = pagedLocations(400);
    const { run, calls } = list(pages);
    const { value } = await run();
    expect(value.locations).toHaveLength(250);
    expect(value.truncated).toBe(true);
    expect(calls).toHaveLength(6);
  });

  it('filters inactive locations defensively', async () => {
    const { value } = await list([inactiveMixBody]).run();
    expect(value.locations.map((l) => l.id)).toEqual([location(2).id, location(3).id]);
  });

  it('sorts by name then id whatever the server order', async () => {
    const mixed = [
      { ...location(1), name: 'B', id: 'gid://2' },
      { ...location(2), name: 'A', id: 'gid://9' },
      { ...location(3), name: 'B', id: 'gid://1' },
    ];
    const { value } = await list([locationsPage(mixed, null)]).run();
    expect(value.locations.map((l) => l.id)).toEqual(['gid://9', 'gid://1', 'gid://2']);
  });

  it('follows cursors of 50 until hasNextPage is false', async () => {
    const { run, calls } = list(pagedLocations(120));
    await run();
    expect(
      calls.map((c) => (JSON.parse(String(c.body)) as { variables: unknown }).variables),
    ).toEqual([{ after: null }, { after: 'c1' }, { after: 'c2' }]);
  });

  it('returns an empty list for empty nodes', async () => {
    const { value } = await list([emptyLocationsBody]).run();
    expect(value).toEqual({ locations: [], truncated: false });
  });

  it('rejects a next page without a cursor', async () => {
    await expect(list([locationsPage([location(1)], null, true)]).run()).rejects.toMatchObject({
      kind: 'INVALID_RESPONSE',
    });
  });

  it('surfaces a page failure kind', async () => {
    await expect(list([accessDenied200Body]).run()).rejects.toMatchObject({
      kind: 'SCOPE_MISSING',
    });
  });
});
