import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

const servers: Server[] = [];

/** Loopback-only server on an ephemeral port; never listens on a public interface. */
const listen = async (handler: RequestListener) => {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as AddressInfo).port };
};

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
  );
});

describe('VS1: Node fetch with redirect error', () => {
  it('rejects on a 302 and the redirect target receives zero requests', async () => {
    let targetHits = 0;
    const target = await listen((_req, res) => {
      targetHits += 1;
      res.end('{}');
    });
    const origin = await listen((_req, res) => {
      res.writeHead(302, { location: `http://127.0.0.1:${target.port}/landed` }).end();
    });
    await expect(
      fetch(`http://127.0.0.1:${origin.port}/start`, { method: 'POST', redirect: 'error' }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(targetHits).toBe(0);
  });
});
