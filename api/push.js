// POST /api/push  (Authorization: Bearer <mật khẩu admin hoặc PUSH_TOKEN>)
// body = JSON kết quả có trường "date"  |  body {ping:true} để kiểm tra mật khẩu
import { DATE_RE, K, authRole, bearer, fail, pipeline, readBody, redis, sendJson, sleep } from './_lib.js';
import { REGIONS, regionDone, saveDayIfDone } from './_sources.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Chỉ nhận POST' });
  try {
    const role = await authRole(bearer(req));
    if (!role) { await sleep(700); return sendJson(res, 401, { message: 'Sai mật khẩu hoặc token' }); }
    const body = readBody(req);
    if (body && body.ping) return sendJson(res, 200, { ok: true, role });
    const date = body && body.date;
    if (!date || !DATE_RE.test(date)) return sendJson(res, 400, { message: 'Thiếu hoặc sai trường date (YYYY-MM-DD)' });
    const text = JSON.stringify(body);
    if (text.length > 300 * 1024) return sendJson(res, 413, { message: 'Dữ liệu quá lớn' });
    let before = null; try { before = JSON.parse((await redis('GET', K.day(date))) || 'null'); } catch { }
    const doneBefore = REGIONS.filter((r) => regionDone(before, r));
    await pipeline([
      ['SET', K.day(date), text],
      ['HSET', K.sizes, date, String(Buffer.byteLength(text))],
      ['SADD', K.dirty, date]
    ]);
    // Nhập tay xong một miền thì cũng tự lưu vào data/ trên GitHub
    const saved = await saveDayIfDone(date, body, doneBefore);
    sendJson(res, 200, { ok: true, bytes: text.length, github: saved });
  } catch (e) { fail(res, e); }
}
