// GET /api/results?date=YYYY-MM-DD  -> kết quả của ngày đó
// Đọc từ Redis; ngày cũ không còn trong Redis thì đọc bản sao lưu data/YYYY-MM-DD.json trên GitHub.
// Trong giờ quay, nếu admin bật nguồn tự động (Minh Ngọc / Xổ Số VN) thì tự lấy số mới (tối đa 6 giây/lần).
import { DATE_RE, K, addDays, fail, ghRead, redis, sendJson, vnToday } from './_lib.js';
import { autoSync, autoSyncPast } from './_sources.js';

export default async function handler(req, res) {
  const date = String((req.query && req.query.date) || '');
  if (!DATE_RE.test(date)) return sendJson(res, 400, { message: 'date không hợp lệ' });
  try {
    let raw = await redis('GET', K.day(date));
    if (date === vnToday()) {
      try {
        let doc = null; try { doc = raw ? JSON.parse(raw) : null; } catch { doc = null; }
        const r = await autoSync(date, doc);
        if (r && r.changed) raw = JSON.stringify(r.doc);
      } catch { /* nguồn ngoài lỗi thì vẫn trả dữ liệu đang có */ }
    }
    const old = date < addDays(vnToday(), -1);
    if (!raw && old) { try { raw = await ghRead('data/' + date + '.json'); } catch { raw = null; } }
    // Ngày đã qua mà còn thiếu số (Điện toán, Thần Tài, Vietlott, đài chưa đủ giải...) → tự lấy bổ sung từ nguồn
    if (date < vnToday()) {
      try {
        let doc = null; try { doc = raw ? JSON.parse(raw) : null; } catch { doc = null; }
        const r = await autoSyncPast(date, doc);
        if (r && r.changed) raw = JSON.stringify(r.doc);
      } catch { }
    }
    if (!raw) return sendJson(res, 404, { message: 'Chưa có dữ liệu' }, old ? 'public, s-maxage=300' : 'public, s-maxage=2');
    // s-maxage=2: mọi người xem dùng chung 1 lần đọc Redis mỗi 2 giây (tiết kiệm hạn mức miễn phí)
    sendJson(res, 200, raw, old ? 'public, s-maxage=300, stale-while-revalidate=600' : 'public, s-maxage=2, stale-while-revalidate=4');
  } catch (e) { fail(res, e); }
}
