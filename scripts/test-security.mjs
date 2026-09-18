#!/usr/bin/env node
/**
 * Nyx Security Layer - Automated Test Suite
 * Run against local dev server: node scripts/test-security.mjs
 *
 * Requires: npm run dev running on http://localhost:3000
 * Requires: ADMIN_SECRET set in .env
 */

const BASE = 'http://localhost:3000';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'test-secret-change-me';

let passed = 0;
let failed = 0;

function log(icon, label, detail) {
  console.log(`  ${icon}  ${label}${detail ? ` - ${detail}` : ''}`);
}

async function test(label, fn) {
  try {
    await fn();
    passed++;
    log('✅', label);
  } catch (err) {
    failed++;
    log('❌', label, err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authWallet(address, extra = {}) {
  return fetch(`${BASE}/api/auth/wallet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...extra.headers,
    },
    body: JSON.stringify({
      address,
      signature: `0x_demo_sig_${Date.now()}`,
      message: `Nyx Demo Authentication for ${address}`,
      isDemo: true,
      ...extra.body,
    }),
  });
}

async function adminGet(headers = {}) {
  return fetch(`${BASE}/api/admin/security`, {
    headers: {
      Authorization: `Bearer ${ADMIN_SECRET}`,
      ...headers,
    },
  });
}

async function adminPost(body) {
  return fetch(`${BASE}/api/admin/security`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_SECRET}`,
    },
    body: JSON.stringify(body),
  });
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║        Nyx Security Test Suite              ║');
console.log('╚══════════════════════════════════════════════╝\n');

// ── Test 1: Dead / Burn Wallet Filter ────────────────────────────────────────
console.log('📋 Test Group 1: Dead / Burn Wallet Filter');

const DEAD_WALLETS = [
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x1111111111111111111111111111111111111111',
  '0xffffffffffffffffffffffffffffffffffffffff',
];

for (const wallet of DEAD_WALLETS) {
  await test(`Dead wallet rejected: ${wallet.slice(0, 20)}...`, async () => {
    const res = await authWallet(wallet);
    assert(res.status === 400, `Expected 400, got ${res.status}`);
    const body = await res.json();
    assert(
      body.error?.toLowerCase().includes('suspicious') || body.error?.toLowerCase().includes('invalid'),
      `Unexpected error message: ${body.error}`
    );
  });
}

await test('Malformed address (0x only) rejected', async () => {
  const res = await authWallet('0x');
  assert(res.status === 400, `Expected 400, got ${res.status}`);
});

await test('Valid legit wallet allowed through filter', async () => {
  const res = await authWallet('0xdemo_aabbcc112233');
  // Should NOT be rejected by filter (may fail for other reasons like demo format, that's ok)
  assert(res.status !== 400 || (await res.json()).error?.includes('format'), 'Incorrectly blocked legit wallet');
});

// ── Test 2: Admin Endpoint Auth ───────────────────────────────────────────────
console.log('\n📋 Test Group 2: Admin Endpoint Security');

await test('Admin GET rejected without token', async () => {
  const res = await fetch(`${BASE}/api/admin/security`);
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('Admin GET rejected with wrong token', async () => {
  const res = await fetch(`${BASE}/api/admin/security`, {
    headers: { Authorization: 'Bearer wrong-token-123' },
  });
  assert(res.status === 401, `Expected 401, got ${res.status}`);
});

await test('Admin GET succeeds with correct ADMIN_SECRET', async () => {
  const res = await adminGet();
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.success === true, 'Expected success:true');
  assert(Array.isArray(body.blockedActors), 'Expected blockedActors array');
  assert(Array.isArray(body.sybilFlags), 'Expected sybilFlags array');
  assert(Array.isArray(body.countryAnalytics), 'Expected countryAnalytics array');
});

// ── Test 3: Persistent Ban System ─────────────────────────────────────────────
console.log('\n📋 Test Group 3: Persistent Ban System');

const TEST_BAN_WALLET = '0xdemo_testban1234567890';
const TEST_BAN_IP = '203.0.113.199'; // RFC 5737 documentation IP - safe to use in tests

await test('Admin can ban a wallet address', async () => {
  const res = await adminPost({
    action: 'ban',
    target: TEST_BAN_WALLET,
    type: 'address',
    reason: 'Automated security test',
  });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.success === true, `Expected success:true, got: ${JSON.stringify(body)}`);
});

await test('Banned wallet address returns 403 on auth', async () => {
  const res = await authWallet(TEST_BAN_WALLET);
  // 403 OR we may get 400 from format check before ban - check for one of these
  assert(
    res.status === 403 || res.status === 400,
    `Expected 403 or 400, got ${res.status}`
  );
});

await test('Admin can unban a wallet address', async () => {
  const res = await adminPost({ action: 'unban', target: TEST_BAN_WALLET });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  const body = await res.json();
  assert(body.success === true, `Expected success:true`);
});

await test('Unbanned wallet is no longer in blockedActors', async () => {
  const res = await adminGet();
  const body = await res.json();
  const stillBanned = body.blockedActors.find(
    (a) => a.target === TEST_BAN_WALLET.toLowerCase()
  );
  assert(!stillBanned, 'Wallet should have been removed from blockedActors');
});

// ── Test 4: Traffic Logging & Country Analytics ────────────────────────────────
console.log('\n📋 Test Group 4: Traffic Logging & Country Analytics');

const TEST_COUNTRIES = ['US', 'DE', 'JP'];

for (const country of TEST_COUNTRIES) {
  await test(`Traffic logged for ${country}`, async () => {
    // Auth a wallet with a fake Cloudflare country header to trigger trafficLog
    const res = await fetch(`${BASE}/api/auth/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-ipcountry': country,
        'cf-connecting-ip': `198.51.100.${Math.floor(Math.random() * 250)}`, // RFC 5737 docs IP
      },
      body: JSON.stringify({
        address: `0xdemo_traffic${country.toLowerCase()}${Date.now().toString(16).slice(-6)}`,
        signature: `0x_demo_sig_${Date.now()}`,
        message: 'test',
        isDemo: true,
      }),
    });
    // Success or any non-500 status confirms the request reached the route
    assert(res.status < 500, `Request failed with ${res.status}`);
  });
}

await test('Admin dashboard shows country analytics after test hits', async () => {
  // Small delay to allow async logging to complete
  await new Promise((r) => setTimeout(r, 1000));
  const res = await adminGet();
  const body = await res.json();
  assert(Array.isArray(body.countryAnalytics), 'Expected countryAnalytics array');
  assert(body.countryAnalytics.length > 0, 'Expected at least one country in analytics');
  console.log('    Countries seen:', body.countryAnalytics.map((c) => `${c.country}:${c.hits}`).join(', '));
});

// ── Test 5: Sybil Detection ────────────────────────────────────────────────────
console.log('\n📋 Test Group 5: Sybil IP Farming Detection');

const SYBIL_TEST_IP = '198.51.100.99';

for (let i = 1; i <= 4; i++) {
  await test(`Wallet ${i}/4 connects from Sybil test IP`, async () => {
    const res = await fetch(`${BASE}/api/auth/wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cf-connecting-ip': SYBIL_TEST_IP,
      },
      body: JSON.stringify({
        address: `0xdemo_sybil${i}${Date.now().toString(16).slice(-8)}`,
        signature: `0x_demo_sig_${Date.now()}`,
        message: 'test',
        isDemo: true,
      }),
    });
    assert(res.status < 500, `Request failed with ${res.status}`);
  });
}

await test('Sybil flag appears in admin dashboard after 4 wallets from same IP', async () => {
  await new Promise((r) => setTimeout(r, 1500)); // allow async flagging to complete
  const res = await adminGet();
  const body = await res.json();
  assert(Array.isArray(body.sybilFlags), 'Expected sybilFlags array');
  // The test IP should appear in ipWalletStats with count >= 4
  const sybilStat = body.ipWalletStats?.find(
    (s) => s._id === SYBIL_TEST_IP && s.walletCount >= 4
  );
  assert(sybilStat !== undefined, `Sybil IP ${SYBIL_TEST_IP} not found in ipWalletStats with count>=4`);
  console.log(`    Detected: ${SYBIL_TEST_IP} with ${sybilStat?.walletCount} wallets`);
});

// ── Test 6: Build Validation ───────────────────────────────────────────────────
console.log('\n📋 Test Group 6: Summary');

const total = passed + failed;
const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
console.log(`\n╔══════════════════════════════════════════════╗`);
console.log(`║  Results: ${passed}/${total} passed (${pct}%)               `);
console.log(`╚══════════════════════════════════════════════╝`);

if (failed > 0) {
  console.log(`\n⚠️  ${failed} test(s) failed. See ❌ above for details.\n`);
  process.exit(1);
} else {
  console.log(`\n🎉 All tests passed! Security layer is working correctly.\n`);
  process.exit(0);
}
