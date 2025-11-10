/* eslint-env jest */

describe('scripts/wait-for-dev', () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.BASE_URL;
  });

  test('check resolves ok:true with status when an HTTP server responds', async () => {
    // create a real server so the check() performs an actual request
    const nodeHttp = await import('http');
    const srv = nodeHttp.createServer((req, res) => {
      res.statusCode = 200;
      res.end('ok');
    });
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const { port } = srv.address();
    process.env.BASE_URL = `http://127.0.0.1:${port}`;

    const { check } = await import('../wait-for-dev.js');
    const res = await check();
    expect(res).toEqual({ ok: true, status: 200 });

    await new Promise((resolve) => srv.close(resolve));
  });

  test('check resolves ok:false when no server is listening', async () => {
    // pick an ephemeral port by starting and closing a server, then use that port
    const nodeHttp = await import('http');
    const srv = nodeHttp.createServer(() => {});
    await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
    const { port } = srv.address();
    await new Promise((resolve) => srv.close(resolve));

    process.env.BASE_URL = `http://127.0.0.1:${port}`;
    const { check } = await import('../wait-for-dev.js');
    const res = await check();
    expect(res).toEqual({ ok: false });
  });
});
