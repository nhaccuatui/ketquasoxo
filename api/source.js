// Nguồn kết quả tự động (chỉ admin)
// POST /api/source {action:"get"}                                  -> cấu hình + lần lấy gần nhất
// POST /api/source {action:"save", mode, fallback}                 -> lưu nguồn (minhngoc | xosovnm | off)
// POST /api/source {action:"sync", date, mode?, dry?}              -> lấy kết quả 1 ngày ngay (dry = chỉ xem thử, không lưu)
import { DATE_RE, K, fail, readBody, redis, requireAdmin, sendJson, vnToday } from './_lib.js';
import { SOURCES, getSrc, syncDay } from './_sources.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Chỉ nhận POST' });
  try {
    if (!(await requireAdmin(req, res))) return;
    const b = readBody(req) || {};
    const sources = Object.keys(SOURCES).map((k) => ({ id: k, label: SOURCES[k].label, home: SOURCES[k].home }));
    if (b.action === 'save') {
      const mode = ['minhngoc', 'xosovnm', 'off'].includes(b.mode) ? b.mode : 'minhngoc';
      const cfg = { mode, fallback: b.fallback !== false };
      await redis('SET', K.src, JSON.stringify(cfg));
      // Ghi tên nguồn vào nội dung trang để hiện dòng "Nguồn dữ liệu" ở chân trang
      let st = {}; try { st = JSON.parse((await redis('GET', K.settings)) || '{}'); } catch { st = {}; }
      st.dataSource = mode === 'off' ? null : { label: SOURCES[mode].label.replace(/\s*\(.*\)$/, ''), url: SOURCES[mode].home };
      await redis('SET', K.settings, JSON.stringify(st));
      return sendJson(res, 200, { ok: true, cfg, sources });
    }
    if (b.action === 'sync') {
      const date = DATE_RE.test(String(b.date || '')) ? b.date : vnToday();
      const mode = ['minhngoc', 'xosovnm'].includes(b.mode) ? b.mode : undefined;
      const cfg = await getSrc();
      const r = await syncDay(date, { cfg: mode ? { ...cfg, fallback: false } : cfg, mode, dry: !!b.dry });
      return sendJson(res, 200, r);
    }
    const cfg = await getSrc();
    let last = null; try { last = JSON.parse((await redis('GET', K.srcStat)) || 'null'); } catch { }
    sendJson(res, 200, { cfg, last, sources });
  } catch (e) { fail(res, e); }
}
