// Poll http://localhost:3000 until it responds or timeout
import http from 'http';
const url = process.env.BASE_URL || 'http://localhost:3000';
const timeout = 60000;
const interval = 1500;

function check() {
  return new Promise(resolve => {
    const req = http.get(url, res => {
      resolve({ ok: true, status: res.statusCode });
    }).on('error', () => resolve({ ok: false }));
    req.setTimeout(5000, () => { req.abort(); resolve({ ok: false }); });
  });
}

(async () => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const r = await check();
    if (r.ok) {
      console.log('OK', r.status);
      process.exit(0);
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, interval));
  }
  console.error('\nTimed out waiting for', url);
  process.exit(2);
})();