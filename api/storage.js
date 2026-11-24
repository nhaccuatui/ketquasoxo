// POST /api/storage (Bearer mật khẩu admin) -> số ngày, dung lượng, theo từng tháng, lần sao lưu gần nhất
import { K, LIMIT_BYTES, fail, ghConf, hashToObj, pipeline, requireAdmin, sendJson } from './_lib.js';

export default async function handler(req, res) {
  try {
    if (!(await requireAdmin(req, res))) return;
    const [flat, last, setLen, dirty] = await pipeline([
      ['HGETALL', K.sizes], ['GET', K.lastBackup], ['STRLEN', K.settings], ['SCARD', K.dirty]
    ]);
    const sizes = hashToObj(flat);
    const dates = Object.keys(sizes).sort();
    const months = {};
    let bytes = Number(setLen) || 0;
    for (const d of dates) {
      const b = Number(sizes[d]) || 0, m = d.slice(0, 7);
      bytes += b;
      (months[m] = months[m] || { days: 0, bytes: 0 }).days++;
      months[m].bytes += b;
    }
    const g = ghConf();
    let lastBackup = null; try { lastBackup = last ? JSON.parse(last) : null; } catch { }
    sendJson(res, 200, {
      days: dates.length, bytes, limitBytes: LIMIT_BYTES,
      oldest: dates[0] || null, newest: dates[dates.length - 1] || null,
      months, pendingBackup: Number(dirty) || 0, lastBackup,
      github: g ? { repo: g.repo, branch: g.branch } : null,
      cron: !!process.env.CRON_SECRET
    });
  } catch (e) { fail(res, e); }
}
