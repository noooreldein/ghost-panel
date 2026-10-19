// Simple Node script to test login flow and cookie handling
const fetch = global.fetch || require('node-fetch');

function parseSetCookie(setCookie) {
  if (!setCookie) return null;
  // accept string or array
  const sc = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return sc.split(';')[0];
}

async function main() {
  const base = 'http://127.0.0.1:3000';
  console.log('Fetching captcha...');
  const capRes = await fetch(base + '/api/captcha');
  const capJson = await capRes.json();
  console.log('captcha:', capJson);

  const q = capJson.question;
  const m = q.match(/(\d+)\s*([+\-*])\s*(\d+)/);
  let ans = 0;
  if (m) {
    const a = Number(m[1]), op = m[2], b = Number(m[3]);
    if (op === '+') ans = a + b;
    if (op === '-') ans = a - b;
    if (op === '*') ans = a * b;
  }

  const body = { username: 'zoro128', password: 'zoro128', captchaId: capJson.id, captchaAnswer: String(ans) };
  console.log('Posting login...');
  const loginRes = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const loginJson = await loginRes.json();
  console.log('login body:', loginJson);
  const setCookie = parseSetCookie(loginRes.headers.get('set-cookie'));
  console.log('set-cookie:', setCookie);

  const debugHeaders = {};
  if (setCookie) debugHeaders['cookie'] = setCookie;
  console.log('Calling /api/auth/debug with cookie...');
  const debugRes = await fetch(base + '/api/auth/debug', { headers: debugHeaders });
  console.log('debug status:', debugRes.status);
  console.log(await debugRes.text());

  console.log('Requesting /dashboard with cookie...');
  const dashRes = await fetch(base + '/dashboard', { headers: debugHeaders, redirect: 'manual' });
  console.log('dashboard status:', dashRes.status);
  console.log('dashboard location:', dashRes.headers.get('location'));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
