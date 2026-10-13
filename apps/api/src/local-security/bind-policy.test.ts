import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { parseEnv } from '../config/env.schema.js';
import { BootError } from '../shared-kernel/boot-error.js';
import {
  isLoopbackAddress,
  isLoopbackHost,
  nonLoopbackBindEvent,
  verifyBoundAddress,
} from './bind-policy.js';

const info = (address: string, family = 'IPv4'): AddressInfo => ({ address, family, port: 4321 });

describe('isLoopbackAddress (an address literal, as a socket reports it)', () => {
  it.each(['127.0.0.1', '127.0.0.2', '127.255.255.254', '::1', '0:0:0:0:0:0:0:1'])(
    'accepts %s',
    (address) => {
      expect(isLoopbackAddress(address)).toBe(true);
    },
  );

  it.each([
    '0.0.0.0',
    '::',
    '10.0.0.1',
    '192.168.1.20',
    '128.0.0.1',
    '126.255.255.255',
    '::ffff:127.0.0.1',
    'localhost',
    '127.0.0.1.evil.test',
    '',
  ])('refuses %j', (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});

describe('isLoopbackHost (a configured host)', () => {
  it.each(['localhost', 'LOCALHOST', '127.0.0.1', '::1'])('accepts %s', (host) => {
    expect(isLoopbackHost(host)).toBe(true);
  });

  it.each(['0.0.0.0', '::', 'example.com', 'localhost.', 'sub.localhost', 'localhost.evil.test'])(
    'refuses %s',
    (host) => {
      expect(isLoopbackHost(host)).toBe(false);
    },
  );

  // The same rule exists in the configuration schema. This keeps the two from drifting apart.
  it.each([
    '127.0.0.1',
    '127.9.9.9',
    'localhost',
    'LocalHost',
    '::1',
    '[::1]',
    '0:0:0:0:0:0:0:1',
    '0.0.0.0',
    '::',
    '[::]',
    '192.168.0.5',
    'example.com',
    'localhost.',
    'sub.localhost',
    '::ffff:127.0.0.1',
    '128.0.0.1',
  ])('agrees with the schema about %s', (host) => {
    const opted = parseEnv({ API_HOST: host, ALLOW_NON_LOOPBACK: 'true' });
    let schemaSaysLoopback = true;
    try {
      parseEnv({ API_HOST: host });
    } catch {
      schemaSaysLoopback = false;
    }
    expect(isLoopbackHost(opted.apiHost)).toBe(schemaSaysLoopback);
  });
});

describe('verifyBoundAddress', () => {
  it.each([info('127.0.0.1'), info('::1', 'IPv6'), info('127.0.0.5')])(
    'accepts the loopback address %o without the opt-in',
    (address) => {
      expect(verifyBoundAddress(address, false)).toBe(address);
    },
  );

  it.each([info('0.0.0.0'), info('::', 'IPv6'), info('192.168.1.20'), info('10.1.2.3')])(
    'refuses %o without the opt-in, with a typed error that names API_HOST',
    (address) => {
      expect(() => verifyBoundAddress(address, false)).toThrow(BootError);
      try {
        verifyBoundAddress(address, false);
      } catch (error) {
        expect(error).toMatchObject({ code: 'BIND_ADDRESS_NOT_ALLOWED' });
        expect((error as Error).message).toContain('API_HOST');
        expect((error as Error).message).toContain(address.address);
      }
    },
  );

  it.each([info('0.0.0.0'), info('::', 'IPv6'), info('192.168.1.20')])(
    'accepts %o when the opt-in is set',
    (address) => {
      expect(verifyBoundAddress(address, true)).toBe(address);
    },
  );

  it.each([null, '/run/app.sock'])(
    'refuses %j: it is not a network address, whatever the opt-in',
    (address) => {
      expect(() => verifyBoundAddress(address, false)).toThrow(BootError);
      expect(() => verifyBoundAddress(address, true)).toThrow(BootError);
    },
  );
});

describe('nonLoopbackBindEvent', () => {
  const hosts = new Set(['0.0.0.0:3000', '127.0.0.1:5173']);

  it('describes the bind, once, when a non-loopback host has the opt-in', () => {
    const event = nonLoopbackBindEvent({
      host: '0.0.0.0',
      port: 3000,
      allowNonLoopback: true,
      acceptedHosts: hosts,
    });
    expect(event).toMatchObject({
      event: 'non_loopback_bind',
      host: '0.0.0.0',
      port: 3000,
      acceptedHosts: ['0.0.0.0:3000', '127.0.0.1:5173'],
    });
    expect(event?.message).toMatch(/no authentication/i);
    expect(event?.message).toContain('ALLOWED_ORIGINS');
  });

  it('carries the port that is really listened on', () => {
    const event = nonLoopbackBindEvent({
      host: '10.0.0.4',
      port: 8080,
      allowNonLoopback: true,
      acceptedHosts: hosts,
    });
    expect(event).toMatchObject({ host: '10.0.0.4', port: 8080 });
  });

  it.each(['127.0.0.1', 'localhost', '::1'])('stays silent for the loopback host %s', (host) => {
    const input = { host, port: 3000, allowNonLoopback: true, acceptedHosts: hosts };
    expect(nonLoopbackBindEvent(input)).toBeNull();
  });

  it('stays silent without the opt-in', () => {
    const input = { host: '0.0.0.0', port: 3000, allowNonLoopback: false, acceptedHosts: hosts };
    expect(nonLoopbackBindEvent(input)).toBeNull();
  });
});
