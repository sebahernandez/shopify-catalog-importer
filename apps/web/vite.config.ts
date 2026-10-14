import { isIPv6 } from 'node:net';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type ProxyOptions, type ServerOptions } from 'vite';

// The only file of the web package that may read the environment (see eslint.config.js). No
// variable has a VITE_ prefix, so nothing from the environment reaches the browser bundle: do not
// add `define` entries or widen `envPrefix`.

// Defaults mirror apps/api/src/config/env.schema.ts. This file cannot import API code, so the two
// copies must be kept in sync by hand.
const DEFAULTS = { webHost: '127.0.0.1', webPort: 5173, apiHost: '127.0.0.1', apiPort: 3000 };

type Env = Readonly<Record<string, string | undefined>>;

export class WebConfigError extends Error {
  constructor(message: string) {
    super(`Invalid web configuration: ${message}`);
    this.name = 'WebConfigError';
  }
}

const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const HOSTNAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PLAIN_PORT = /^[1-9][0-9]{0,4}$/;

function parsePort(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!PLAIN_PORT.test(raw) || Number(raw) > 65535) {
    throw new WebConfigError(`${name} must be a whole number from 1 to 65535.`);
  }
  return Number(raw);
}

function parseOptIn(env: Env): boolean {
  const raw = env.ALLOW_NON_LOOPBACK;
  if (raw === undefined || raw === 'false') return false;
  if (raw === 'true') return true;
  throw new WebConfigError('ALLOW_NON_LOOPBACK must be exactly true or false.');
}

function classify(host: string): 'loopback' | 'other' | 'invalid' {
  if (IPV4.test(host)) return host.startsWith('127.') ? 'loopback' : 'other';
  if (isIPv6(host)) return new URL(`http://[${host}]`).hostname === '[::1]' ? 'loopback' : 'other';
  if (host === 'localhost') return 'loopback';
  return HOSTNAME.test(host) ? 'other' : 'invalid';
}

// Returns the bare, lower-case host (no brackets around IPv6), the form `listen` and URLs expect.
function parseHost(env: Env, name: string, fallback: string, optIn: boolean): string {
  const raw = env[name] ?? fallback;
  const bracketed = /^\[(.*)\]$/.exec(raw);
  const host = (bracketed?.[1] ?? raw).toLowerCase();
  const kind = bracketed && !isIPv6(host) ? 'invalid' : classify(host);
  if (kind === 'loopback') return host;
  if (!optIn) {
    throw new WebConfigError(`${name} must be a loopback host unless ALLOW_NON_LOOPBACK is true.`);
  }
  if (kind === 'invalid') throw new WebConfigError(`${name} must be a host name or address.`);
  return host;
}

// The target comes from configuration only, never from request data. Host and Origin are left as
// the client sent them (changeOrigin false) because the API's local request guard checks both.
// The patterns match the prefix itself and anything below it, not look-alikes such as /apix.
function proxyTo(target: string): Record<string, ProxyOptions> {
  const options: ProxyOptions = { target, changeOrigin: false };
  return { '^/api(?:[/?]|$)': options, '^/health(?:[/?]|$)': { ...options } };
}

export function resolveDevServer(env: Env): ServerOptions {
  const optIn = parseOptIn(env);
  const host = parseHost(env, 'WEB_HOST', DEFAULTS.webHost, optIn);
  const port = parsePort(env, 'WEB_PORT', DEFAULTS.webPort);
  const apiHost = parseHost(env, 'API_HOST', DEFAULTS.apiHost, optIn);
  const apiPort = parsePort(env, 'API_PORT', DEFAULTS.apiPort);
  const authority = apiHost.includes(':') ? `[${apiHost}]` : apiHost;
  return {
    host,
    port,
    strictPort: true,
    open: false,
    proxy: proxyTo(`http://${authority}:${apiPort}`),
  };
}

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  server: resolveDevServer(process.env),
}));
