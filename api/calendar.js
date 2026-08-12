/* POST /api/calendar — 캘린더 팩 교체 (admin 전용)
   매일 아침 자동 빌드 태스크가 여기로 바로 밀어넣으면, 팀 전원이 다음 새로고침에 최신 캘린더를 본다. */
const { KEY_CAL, rget, rset, roleOf, json } = require('./_lib');

/* 자동 빌드 태스크 전용 키 — 관리자 비밀번호를 스케줄 프롬프트에 적어두지 않기 위해 분리 */
function pushKeyOk(req) {
  const k = process.env.CALENDAR_PUSH_KEY || '';
  return !!k && (req.headers['x-bb-key'] || '') === k;
}

module.exports = async (req, res) => {
  const role = roleOf(req) || (pushKeyOk(req) ? 'admin' : null);
  if (!role) return json(res, 401, { error: 'UNAUTHORIZED' });

  if (req.method === 'GET') {
    try {
      const p = await rget(KEY_CAL);
      if (!p) return json(res, 200, { generated: '', months: {} });
      const months = Object.keys(p.months || {});
      return json(res, 200, { generated: p.generated || '', months });
    } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
  }

  if (req.method === 'POST') {
    if (role !== 'admin') return json(res, 403, { error: 'READ_ONLY' });
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || !body.months || typeof body.months !== 'object' || !Object.keys(body.months).length) {
      return json(res, 400, { error: 'BAD_PACK' });
    }
    /* 정합성: 각 달의 항목이 0건이면 파싱 실패로 보고 거부한다 */
    const empty = Object.keys(body.months).filter(m => {
      const tabs = body.months[m] || {};
      return !Object.keys(tabs).some(t => Object.keys(tabs[t] || {}).some(d => (tabs[t][d] || []).length));
    });
    if (empty.length) return json(res, 400, { error: 'EMPTY_MONTHS', months: empty });

    try {
      await rset(KEY_CAL, { generated: body.generated || new Date().toISOString().slice(0, 10), months: body.months });
      return json(res, 200, { ok: true, months: Object.keys(body.months) });
    } catch (e) { return json(res, 500, { error: String(e.message || e) }); }
  }

  return json(res, 405, { error: 'METHOD_NOT_ALLOWED' });
};
