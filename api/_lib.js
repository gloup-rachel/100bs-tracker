/* 공통 유틸: 인증 + 저장소 (외부 패키지 없음, fetch만 사용)
 *
 * 저장소는 환경변수로 자동 선택한다.
 *   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 가 있으면  → Supabase (권장)
 *   - 없고 Upstash Redis 변수가 있으면                    → Redis
 */

const KEY_STATE = 'bb:tracker:state';
const KEY_CAL   = 'bb:tracker:calendar';
const TABLE     = process.env.SUPABASE_TABLE || 'bb_tracker_kv';

function backend() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return 'supabase';
  if (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL) return 'redis';
  return null;
}

/* ---------- Supabase (PostgREST) ---------- */
function sbEnv() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_ENV_MISSING');
  return { url, key };
}
function sbHeaders(extra) {
  const { key } = sbEnv();
  return Object.assign({
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }, extra || {});
}
async function sbGet(k) {
  const { url } = sbEnv();
  const r = await fetch(
    `${url}/rest/v1/${TABLE}?key=eq.${encodeURIComponent(k)}&select=value`,
    { headers: sbHeaders() }
  );
  if (!r.ok) throw new Error('SUPABASE_GET_' + r.status + '_' + (await r.text()).slice(0, 120));
  const rows = await r.json();
  return (rows && rows[0]) ? rows[0].value : null;
}
async function sbSet(k, value) {
  const { url } = sbEnv();
  const r = await fetch(`${url}/rest/v1/${TABLE}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([{ key: k, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error('SUPABASE_SET_' + r.status + '_' + (await r.text()).slice(0, 120));
  return true;
}

/* ---------- Upstash Redis (대체 경로) ---------- */
function redisEnv() {
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('REDIS_ENV_MISSING');
  return { url: url.replace(/\/$/, ''), token };
}
async function rdGet(k) {
  const { url, token } = redisEnv();
  const r = await fetch(`${url}/get/${encodeURIComponent(k)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error('REDIS_GET_' + r.status);
  const j = await r.json();
  if (j.result === null || j.result === undefined) return null;
  try { return JSON.parse(j.result); } catch (e) { return null; }
}
async function rdSet(k, value) {
  const { url, token } = redisEnv();
  const r = await fetch(`${url}/set/${encodeURIComponent(k)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: JSON.stringify(value),
  });
  if (!r.ok) throw new Error('REDIS_SET_' + r.status);
  return true;
}

/* ---------- 공개 API ---------- */
async function rget(k) {
  const b = backend();
  if (!b) throw new Error('STORAGE_NOT_CONFIGURED');
  return b === 'supabase' ? sbGet(k) : rdGet(k);
}
async function rset(k, v) {
  const b = backend();
  if (!b) throw new Error('STORAGE_NOT_CONFIGURED');
  return b === 'supabase' ? sbSet(k, v) : rdSet(k, v);
}

/* 'admin' | 'team' | null */
function roleOf(req) {
  /* 헤더는 ISO-8859-1만 담을 수 있어 클라이언트가 encodeURIComponent로 보낸다 */
  let pw = req.headers['x-bb-pw'] || '';
  try { pw = decodeURIComponent(pw); } catch (e) { /* 이미 평문이면 그대로 */ }
  const admin = process.env.ADMIN_PW || '';
  const team  = process.env.TEAM_PW  || '';
  if (admin && pw === admin) return 'admin';
  if (team  && pw === team)  return 'team';
  return null;
}

function json(res, code, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(code).send(JSON.stringify(body));
}

module.exports = { KEY_STATE, KEY_CAL, rget, rset, roleOf, json, backend };
