// POST /api/password  body {current, next} -> đổi mật khẩu admin (lưu dạng mã hóa, không lưu chữ thật)
import { K, fail, hashPw, readBody, redis, requireAdmin, sendJson } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Chỉ nhận POST' });
  try {
    const b = readBody(req) || {};
    if (!(await requireAdmin(req, res, String(b.current || '')))) return;
    const next = String(b.next || '');
    if (next.length < 6) return sendJson(res, 400, { message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    if (next.length > 100) return sendJson(res, 400, { message: 'Mật khẩu mới quá dài (tối đa 100 ký tự).' });
    await redis('SET', K.pw, hashPw(next));
    sendJson(res, 200, { ok: true });
  } catch (e) { fail(res, e); }
}
