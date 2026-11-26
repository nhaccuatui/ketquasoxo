// GET  /api/settings  -> nội dung trang (tên trang, chữ 2 bên, dòng 1-2, watermark, chân trang, chữ chạy, nhạc)
// POST /api/settings  (Bearer mật khẩu admin) body = các mục cần đổi
import { K, fail, readBody, redis, requireAdmin, sendJson } from './_lib.js';

const TEXT = { siteName: 60, slogan: 80, leftText: 80, rightText: 80, line1: 160, line2: 200, wmText: 40, footer1: 300, footer2: 300 };
const str = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const num = (v, d, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };

function clean(patch, cur) {
  const out = { ...cur };
  for (const k of Object.keys(TEXT)) if (patch[k] !== undefined) out[k] = str(patch[k], TEXT[k]);
  if (patch.rollover !== undefined) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(patch.rollover).trim());
    if (m && +m[1] < 24 && +m[2] < 60) out.rollover = m[1].padStart(2, '0') + ':' + m[2];
  }
  if (patch.drawTime && typeof patch.drawTime === 'object') {
    const dt = {};
    for (const k of ['nam', 'trung', 'bac']) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(patch.drawTime[k] || '').trim());
      if (m && +m[1] < 24 && +m[2] < 60) dt[k] = m[1].padStart(2, '0') + ':' + m[2];
    }
    out.drawTime = Object.assign({}, cur.drawTime || {}, dt);
  }
  if (patch.wmOpacity !== undefined) out.wmOpacity = num(patch.wmOpacity, 0.45, 0, 0.5);
  if (patch.ticker && typeof patch.ticker === 'object') {
    const t = patch.ticker, text = str(t.text, 300);
    out.ticker = {
      text,
      on: !!text && t.on !== false,
      everySec: num(t.everySec, 60, 0, 3600),   // cứ N giây chạy 1 lần (0 = chỉ chạy 1 lần)
      seconds: num(t.seconds, 20, 5, 120),      // thời gian chạy hết bề ngang màn hình
      pos: ['mid', 'top', 'bot'].includes(t.pos) ? t.pos : 'mid',
      id: Date.now()
    };
  }
  if (Array.isArray(patch.music)) {
    out.music = patch.music.slice(0, 100).map((m) => ({
      url: str(m && m.url, 600), title: str(m && m.title, 120), kind: m && m.kind === 'file' ? 'file' : 'yt'
    })).filter((m) => /^https:\/\//i.test(m.url));
  }
  out.updatedAt = new Date().toISOString();
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const raw = await redis('GET', K.settings);
      return sendJson(res, 200, raw || '{}', 'public, s-maxage=5, stale-while-revalidate=10');
    }
    if (req.method !== 'POST') return sendJson(res, 405, { message: 'Chỉ nhận GET/POST' });
    if (!(await requireAdmin(req, res))) return;
    const patch = readBody(req) || {};
    let cur = {};
    try { cur = JSON.parse((await redis('GET', K.settings)) || '{}'); } catch { cur = {}; }
    const next = clean(patch, cur);
    const text = JSON.stringify(next);
    await redis('SET', K.settings, text);
    sendJson(res, 200, text);
  } catch (e) { fail(res, e); }
}
