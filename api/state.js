/* GET  /api/state  — 현재 상태 조회 (team / admin)
   POST /api/state  — 상태 저장 (admin 전용, 낙관적 잠금) */
const { KEY_STATE, rget, rset, roleOf, json } = require('./_lib');

const EMPTY = { items: [], log: [], history: [], updatedAt: '', updatedBy: '' };

module.exports = async (req, res) => {
  const role = roleOf(req);
  if (!role) return json(res, 401, { error: 'UNAUTHORIZED' });

  if (req.method === 'GET') {
    try {
      const s = await rget(KEY_STATE);
      return json(res, 200, s || EMPTY);
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  if (req.method === 'POST') {
    if (role !== 'admin') return json(res, 403, { error: 'READ_ONLY' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || !Array.isArray(body.items)) return json(res, 400, { error: 'BAD_PAYLOAD' });

    try {
      const cur = await rget(KEY_STATE);
      /* 낙관적 잠금 — 내가 읽은 이후 누군가 저장했으면 덮어쓰지 않는다 */
      if (cur && cur.updatedAt && body.prevUpdatedAt !== cur.updatedAt) {
        return json(res, 409, { error: 'CONFLICT', serverUpdatedAt: cur.updatedAt, serverUpdatedBy: cur.updatedBy || '' });
      }
      const now = new Date().toISOString();
      const next = {
        items: body.items,
        log: body.log || [],
        history: body.history || [],
        updatedAt: now,
        updatedBy: body.updatedBy || 'Rachel',
      };
      await rset(KEY_STATE, next);
      return json(res, 200, { ok: true, updatedAt: now });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
};
