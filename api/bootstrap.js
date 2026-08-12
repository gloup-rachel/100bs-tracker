/* GET /api/bootstrap — 로그인 확인 + 상품 카탈로그 + 캘린더 팩 */
const { KEY_CAL, rget, roleOf, json } = require('./_lib');
const catalog = require('../data/catalog.json');
const seedCalendar = require('../data/calendar_pack.json');

module.exports = async (req, res) => {
  const role = roleOf(req);
  if (!role) return json(res, 401, { error: 'UNAUTHORIZED' });

  let pack = null;
  try { pack = await rget(KEY_CAL); } catch (e) { /* Redis 미설정이어도 화면은 떠야 한다 */ }

  return json(res, 200, {
    role,
    catalog,
    calendar: (pack && pack.months) ? pack : seedCalendar,
    calendarSource: (pack && pack.months) ? 'redis' : 'seed',
  });
};
