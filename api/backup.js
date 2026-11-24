// Sao lưu dữ liệu lên GitHub (thư mục data/), gộp thành 1 commit.
// GET  /api/backup  -> Vercel Cron gọi mỗi ngày (cần CRON_SECRET)
// POST /api/backup  (Bearer mật khẩu admin) body {month?:"YYYY-MM"} -> nút "Sao lưu ngay"
import { K, addDays, bearer, fail, ghCommit, hashToObj, pipeline, readBody, redis, requireAdmin, secretOk, sendJson, vnToday } from './_lib.js';

export default async function handler(req, res) {
  try {
    let month = null, by = 'cron';
    if (req.method === 'GET') {
      if (!process.env.CRON_SECRET || !secretOk(bearer(req), process.env.CRON_SECRET)) {
        return sendJson(res, 401, { message: 'Thiếu hoặc sai CRON_SECRET' });
      }
    } else if (req.method === 'POST') {
      if (!(await requireAdmin(req, res))) return;
      const b = readBody(req) || {};
      if (/^\d{4}-\d{2}$/.test(String(b.month || ''))) month = b.month;
      by = 'admin';
    } else return sendJson(res, 405, { message: 'Chỉ nhận GET/POST' });

    const [dirtyList, flat] = await pipeline([['SMEMBERS', K.dirty], ['HGETALL', K.sizes]]);
    const have = hashToObj(flat);
    const today = vnToday();
    const want = new Set((dirtyList || []).filter((d) => have[d]));
    [today, addDays(today, -1)].forEach((d) => { if (have[d]) want.add(d); });
    if (month) Object.keys(have).filter((d) => d.startsWith(month + '-')).forEach((d) => want.add(d));
    const dates = [...want].sort();

    const vals = dates.length ? await redis('MGET', ...dates.map(K.day)) : [];
    const files = [];
    dates.forEach((d, i) => {
      if (!vals[i]) return;
      let pretty = vals[i];
      try { pretty = JSON.stringify(JSON.parse(vals[i]), null, 1); } catch { }
      files.push({ path: 'data/' + d + '.json', content: pretty + '\n' });
    });
    const st = await redis('GET', K.settings);
    if (st) files.push({ path: 'data/settings.json', content: JSON.stringify(JSON.parse(st), null, 1) + '\n' });

    const r = await ghCommit(files, 'Sao lưu kết quả ' + today + (by === 'cron' ? ' (tự động)' : ''));
    if (dates.length) await redis('SREM', K.dirty, ...dates);
    const info = { at: new Date().toISOString(), by, days: dates.length, changed: r.changed, commit: r.commit || null };
    await redis('SET', K.lastBackup, JSON.stringify(info));
    sendJson(res, 200, { ok: true, ...info, dates });
  } catch (e) {
    try { await redis('SET', K.lastBackup, JSON.stringify({ at: new Date().toISOString(), error: e.message })); } catch { }
    fail(res, e);
  }
}
