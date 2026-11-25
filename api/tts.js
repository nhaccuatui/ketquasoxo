// GET /api/tts?q=<câu tiếng Việt>  -> file mp3 giọng Google tiếng Việt
// Chỉ dùng khi máy người xem không có sẵn giọng tiếng Việt. Câu giống nhau được Vercel giữ đệm 1 năm nên rất ít gọi lại.
import { sendJson } from './_lib.js';

export default async function handler(req, res) {
  const q = String((req.query && req.query.q) || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!q) return sendJson(res, 400, { message: 'Thiếu nội dung cần đọc' });
  try {
    const url = 'https://translate.google.com/translate_tts?' + new URLSearchParams({ ie: 'UTF-8', tl: 'vi', client: 'tw-ob', q });
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', Referer: 'https://translate.google.com/' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
    res.end(buf);
  } catch (e) {
    sendJson(res, 502, { message: 'Không lấy được giọng đọc tiếng Việt: ' + e.message });
  }
}
