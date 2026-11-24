// POST /api/clear (Bearer mật khẩu admin) body {month:"YYYY-MM", confirm:"MM/YYYY", github:true|false}
// Chỉ xóa dữ liệu của MỘT tháng khi admin bấm nút. Không có xóa tự động.
import { K, fail, ghCommit, ghConf, ghList, hashToObj, pipeline, readBody, redis, requireAdmin, sendJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Chỉ nhận POST' });
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = readBody(req) || {};
    const m = /^(\d{4})-(\d{2})$/.exec(String(b.month || ''));
    if (!m) return sendJson(res, 400, { message: 'Chọn năm và tháng cần xóa.' });
    if (String(b.confirm || '').trim() !== m[2] + '/' + m[1]) {
      return sendJson(res, 400, { message: 'Gõ đúng ' + m[2] + '/' + m[1] + ' vào ô xác nhận để xóa.' });
    }
    const month = b.month;
    const dates = Object.keys(hashToObj(await redis('HGETALL', K.sizes))).filter((d) => d.startsWith(month + '-'));
    if (dates.length) {
      await pipeline([
        ['DEL', ...dates.map(K.day)],
        ['HDEL', K.sizes, ...dates],
        ['SREM', K.dirty, ...dates]
      ]);
    }
    let ghDeleted = 0, ghError = null;
    if (b.github && ghConf()) {
      try {
        const names = (await ghList('data')).filter((n) => n.startsWith(month + '-') && n.endsWith('.json'));
        if (names.length) {
          await ghCommit(names.map((n) => ({ path: 'data/' + n, content: null })), 'Xóa dữ liệu tháng ' + m[2] + '/' + m[1]);
          ghDeleted = names.length;
        }
      } catch (e) { ghError = e.message; }
    }
    sendJson(res, 200, { ok: true, deleted: dates.length, ghDeleted, ghError });
  } catch (e) { fail(res, e); }
}
