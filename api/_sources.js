// Lấy kết quả tự động từ nguồn ngoài và chuyển về đúng cấu trúc dữ liệu của trang.
//  - minhngoc : đọc trang kết quả của Minh Ngọc (minhngoc.net.vn/ket-qua-xo-so/<miền>/<DD-MM-YYYY>.html)
//  - xosovnm  : API công khai của Xổ Số VN (api.xosovnm.net), không cần key
import { DATE_RE, K, ghCommit, ghConf, pipeline, redis, vnToday } from './_lib.js';

export const SOURCES = {
  minhngoc: { label: 'Minh Ngọc (minhngoc.net.vn)', home: 'https://www.minhngoc.net.vn/' },
  xosovnm: { label: 'Xổ Số VN (xosovnm.net)', home: 'https://www.xosovnm.net/' }
};
export const REGIONS = ['nam', 'trung', 'bac'];
const MN_SLUG = { nam: 'mien-nam', trung: 'mien-trung', bac: 'mien-bac' };
const PRIZES = {
  nam: [['g8', 1], ['g7', 1], ['g6', 3], ['g5', 1], ['g4', 7], ['g3', 2], ['g2', 1], ['g1', 1], ['db', 1]],
  bac: [['g7', 4], ['g6', 3], ['g5', 6], ['g4', 4], ['g3', 6], ['g2', 2], ['g1', 1], ['db', 1]]
};
PRIZES.trung = PRIZES.nam;
// Lịch mở thưởng (giống schedule.js) để đặt tên đài khi ngày đó chưa có dữ liệu
const SCHEDULE = [
  { nam: ['Tiền Giang', 'Kiên Giang', 'Đà Lạt'], trung: ['Kon Tum', 'Khánh Hòa', 'Thừa T. Huế'], bac: ['Thái Bình'] },
  { nam: ['TP. HCM', 'Đồng Tháp', 'Cà Mau'], trung: ['Thừa T. Huế', 'Phú Yên'], bac: ['Hà Nội'] },
  { nam: ['Bến Tre', 'Vũng Tàu', 'Bạc Liêu'], trung: ['Đắk Lắk', 'Quảng Nam'], bac: ['Quảng Ninh'] },
  { nam: ['Đồng Nai', 'Cần Thơ', 'Sóc Trăng'], trung: ['Đà Nẵng', 'Khánh Hòa'], bac: ['Bắc Ninh'] },
  { nam: ['Tây Ninh', 'An Giang', 'Bình Thuận'], trung: ['Bình Định', 'Quảng Trị', 'Quảng Bình'], bac: ['Hà Nội'] },
  { nam: ['Vĩnh Long', 'Bình Dương', 'Trà Vinh'], trung: ['Gia Lai', 'Ninh Thuận'], bac: ['Hải Phòng'] },
  { nam: ['TP. HCM', 'Long An', 'Bình Phước', 'Hậu Giang'], trung: ['Đà Nẵng', 'Quảng Ngãi', 'Đắk Nông'], bac: ['Nam Định'] }
];
const DRAW = { nam: [16, 15], trung: [17, 15], bac: [18, 15] };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

/* ---------------- Tên tỉnh: so khớp không dấu ---------------- */
const ALIAS = {
  thuathienhue: 'thuathue', hue: 'thuathue', tphochiminh: 'tphcm', hochiminh: 'tphcm', hcm: 'tphcm', tphcm: 'tphcm',
  lamdong: 'dalat', daclac: 'daklak', daklak: 'daklak', dacnong: 'daknong', kontum: 'kontum', vungtau: 'vungtau',
  bariavungtau: 'vungtau', brvt: 'vungtau', hanoi: 'hanoi', mienbac: 'mienbac', xsmb: 'mienbac', truyenthong: 'mienbac'
};
export function slug(s) {
  const k = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/^(xo so|xs|kqxs)\s*/, '').replace(/[^a-z0-9]/g, '');
  return ALIAS[k] || k;
}

/* ---------------- Tiện ích ---------------- */
const dmy = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
function decode(s) {
  return String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
const text = (h) => decode(String(h || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const nums = (h, len) => (text(h).match(/\d+/g) || []).filter((x) => !len || x.length === len);
async function get(url, json) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: json ? 'application/json' : 'text/html', 'Accept-Language': 'vi-VN,vi;q=0.9' }, signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return json ? r.json() : r.text();
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'quá 8 giây không phản hồi' : e.message);
  } finally { clearTimeout(t); }
}
const LEN = { nam: { g8: 2, g7: 3, g6: 4, g5: 4, g4: 5, g3: 5, g2: 5, g1: 5, db: 6 }, bac: { g7: 2, g6: 3, g5: 4, g4: 4, g3: 5, g2: 5, g1: 5, db: 5 } };
LEN.trung = LEN.nam;

/* ---------------- Nguồn 1: Minh Ngọc (đọc trang HTML) ---------------- */
function cellOf(seg, cls) {
  const m = new RegExp('<td[^>]*class="[^"]*\\b' + cls + '\\b[^"]*"[^>]*>([\\s\\S]*?)</td>', 'i').exec(seg);
  return m ? m[1] : null;
}
// Tìm đúng hộp kết quả của NGÀY CẦN LẤY trong trang (trang Minh Ngọc có nhiều ngày) – không bao giờ lấy nhầm ngày khác
function parseMinhNgoc(html, region, iso) {
  const len = LEN[region];
  const y2 = iso.slice(2, 4), dd = iso.slice(8, 10), mm = iso.slice(5, 7);
  const marks = [];
  const re = new RegExp(dd + '/' + mm + '/(?:' + iso.slice(0, 4) + '|' + y2 + ')(?!\\d)', 'g');
  let m; while ((m = re.exec(html))) marks.push(m.index);
  if (!marks.length) return null;
  const wd = new Date(iso + 'T00:00:00Z').getUTCDay();
  const want = new Set(SCHEDULE[wd][region].map(slug));
  for (const p of marks) {
    const win = html.slice(p, p + 80000);
    if (region === 'bac') {
      const at = win.search(/class="[^"]*\bgiaidb\b/i);
      if (at < 0 || at > 9000) continue;
      const seg = win.slice(0, at + 6000);
      const prizes = {};
      PRIZES.bac.forEach(([id]) => { const c = cellOf(seg, id === 'db' ? 'giaidb' : 'giai' + id.slice(1)); if (c) prizes[id] = nums(c, len[id]); });
      const kh = /\b(\d{1,2}[A-Z]{1,3}(?:\s*-\s*\d{1,2}[A-Z]{1,3}){2,7})\b/.exec(text(seg));
      return { provinces: [{ name: '', code: '', prizes }], kyhieu: kh ? kh[1].split(/\s*-\s*/) : [] };
    }
    // Miền Nam / Trung: mỗi tỉnh là một bảng con class "rightcl"
    const first = win.search(/<table[^>]*class="[^"]*\brightcl\b/i);
    if (first < 0 || first > 9000) continue;
    const parts = win.slice(first).split(/<table[^>]*class="[^"]*\brightcl\b[^"]*"[^>]*>/i).slice(1);
    const seen = new Set(), provinces = [];
    for (const raw of parts) {
      const seg = raw.split(/<\/table>/i)[0];
      const name = text(cellOf(seg, 'tinh'));
      if (!name) continue;
      const key = slug(name);
      if (seen.has(key)) break;                 // đã sang hộp của ngày khác
      if (!want.has(key)) { if (provinces.length) break; else continue; } // tỉnh không mở thưởng ngày này
      seen.add(key);
      const prizes = {};
      PRIZES[region].forEach(([id]) => { const c = cellOf(seg, id === 'db' ? 'giaidb' : 'giai' + id.slice(1)); if (c) prizes[id] = nums(c, len[id]); });
      provinces.push({ name, code: text(cellOf(seg, 'matinh')).replace(/^.*?:\s*/, ''), prizes });
    }
    if (provinces.length) return { provinces };
  }
  return null;
}
// Cách đọc thứ 2 (không phụ thuộc tên class): đọc bảng theo hàng <tr> / ô <td>
// Hàng tiêu đề có tên các đài, hàng "Giải tám", "Giải bảy"... mỗi ô là số của 1 đài theo đúng thứ tự cột.
const PRIZE_LABEL = [[/đặc\s*biệt|\bĐB\b|giải\s*db/i, 'db'], [/giải\s*nhất|\bG\.?\s*1\b/i, 'g1'], [/giải\s*nhì|\bG\.?\s*2\b/i, 'g2'],
  [/giải\s*ba\b|\bG\.?\s*3\b/i, 'g3'], [/giải\s*tư|\bG\.?\s*4\b/i, 'g4'], [/giải\s*năm|\bG\.?\s*5\b/i, 'g5'],
  [/giải\s*sáu|\bG\.?\s*6\b/i, 'g6'], [/giải\s*bảy|\bG\.?\s*7\b/i, 'g7'], [/giải\s*tám|\bG\.?\s*8\b/i, 'g8']];
function parseTableGeneric(html, region, iso) {
  html = decode(html).normalize('NFC');
  const len = LEN[region], ids = new Set(PRIZES[region].map((x) => x[0]));
  const re = new RegExp(iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/(?:' + iso.slice(0, 4) + '|' + iso.slice(2, 4) + ')(?!\\d)', 'g');
  const wd = new Date(iso + 'T00:00:00Z').getUTCDay();
  const want = new Set(SCHEDULE[wd][region].map(slug));
  let m;
  while ((m = re.exec(html))) {
    const win = html.slice(m.index, m.index + 60000);
    const rows = win.split(/<tr[\s>]/i).slice(1).map((r) => r.split(/<\/tr>/i)[0]);
    let cols = null, codes = [], provinces = null, got = 0;
    for (const row of rows) {
      const cells = row.split(/<t[dh][\s>]/i).slice(1).map((c) => c.split(/<\/t[dh]>/i)[0]);
      if (cells.length < 2) continue;
      const tx = cells.map(text);
      if (region !== 'bac') {
        const hit = tx.slice(1).filter((t) => want.has(slug(t))).length;
        if (hit >= 1 && hit >= tx.length - 2) {           // hàng tên đài
          if (provinces && got) break;                     // gặp bảng của ngày khác
          cols = tx.slice(1).map((t) => t.trim());
          provinces = cols.map((n) => ({ name: n, code: '', prizes: {} }));
          continue;
        }
        if (provinces && tx.slice(1).every((t) => /^L\s*:|^(Mã|Ký hiệu)/i.test(t) || !t)) {
          tx.slice(1).forEach((t, i) => { if (provinces[i]) provinces[i].code = t.replace(/^.*?:\s*/, ''); });
          continue;
        }
      }
      const lab = PRIZE_LABEL.find(([r]) => r.test(tx[0]));
      if (!lab || !ids.has(lab[1])) continue;
      if (region === 'bac') {
        provinces = provinces || [{ name: '', code: '', prizes: {} }];
        if (provinces[0].prizes[lab[1]]) break;           // đã sang bảng ngày khác
        provinces[0].prizes[lab[1]] = nums(cells.slice(1).join(' '), len[lab[1]]);
        got++;
      } else if (provinces) {
        if (provinces[0].prizes[lab[1]]) break;
        cells.slice(1).forEach((c, i) => { if (provinces[i]) provinces[i].prizes[lab[1]] = nums(c, len[lab[1]]); });
        got++;
      }
    }
    if (provinces && got) {
      if (region === 'bac') {
        const kh = /\b(\d{1,2}[A-Z]{1,3}(?:\s*-\s*\d{1,2}[A-Z]{1,3}){2,7})\b/.exec(text(win.slice(0, 15000)));
        return { provinces, kyhieu: kh ? kh[1].split(/\s*-\s*/) : [] };
      }
      return { provinces: provinces.filter((p) => want.has(slug(p.name))) };
    }
  }
  return null;
}
// Chẩn đoán: máy chủ nhận được gì từ Minh Ngọc (để sửa nhanh khi đọc không được)
export async function debugMinhNgoc(region, iso) {
  const url = iso === vnToday() ? 'https://www.minhngoc.net.vn/xo-so-truc-tiep/' + MN_SLUG[region] + '.html'
    : 'https://www.minhngoc.net.vn/ket-qua-xo-so/' + MN_SLUG[region] + '/' + iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4) + '.html';
  const out = { url };
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'vi-VN,vi;q=0.9' }, cache: 'no-store' });
    out.status = r.status;
    const html = await r.text();
    out.bytes = html.length;
    const dec = decode(html);
    const d1 = dmy(iso), d2 = d1.slice(0, 6) + d1.slice(8);
    const at = dec.indexOf(d1) >= 0 ? dec.indexOf(d1) : dec.indexOf(d2);
    out.hasDate = at >= 0;
    out.markers = {};
    ['rightcl', 'giai8', 'giaidb', 'tinh', 'matinh', 'bkqmiennam', 'bkqmienbac', 'Giải tám', 'Đặc biệt'].forEach((k) => { out.markers[k] = (dec.match(new RegExp(k, 'gi')) || []).length; });
    out.classParser = !!parseMinhNgoc(html, region, iso);
    out.tableParser = !!parseTableGeneric(html, region, iso);
    out.textNearDate = at >= 0 ? text(dec.slice(at, at + 3000)).slice(0, 700) : text(dec).slice(0, 400);
    out.htmlNearDate = at >= 0 ? dec.slice(at, at + 2500) : dec.slice(0, 1500);
  } catch (e) { out.error = e.message; }
  return out;
}
const filledOf = (r) => (r && r.provinces || []).reduce((s, p) => s + Object.values(p.prizes || {}).reduce((t, a) => t + a.length, 0), 0);
/* ---- Điện toán 1*2*3, 6x36, Thần Tài 4, Vietlott Mega 6/45 & Power 6/55 (nằm cùng trang Miền Bắc của Minh Ngọc) ---- */
// Lấy đoạn chữ ngay sau nhãn (vd "Kết quả xổ số Thần Tài 4"), cắt ở nhãn "Kết quả xổ số" kế tiếp
function after(html, labelRe) {
  const out = [];
  html = decode(html).normalize('NFC');
  const re = new RegExp(labelRe.source, 'gi');
  let m;
  while ((m = re.exec(html))) {
    let seg = html.slice(m.index + m[0].length, m.index + m[0].length + 6000);
    const cut = seg.search(/Kết\s+quả\s+xổ\s+số/i);
    if (cut > 40) seg = seg.slice(0, cut);
    out.push(text(seg));
  }
  return out;
}
const DATE_ANY = /(\d{2})\/(\d{2})\/(\d{4})/;
function pickDaily(html, labelRe, iso, count, digits) {
  for (const t of after(html, labelRe)) {
    const dm = DATE_ANY.exec(t);
    if (!dm || dm[3] + '-' + dm[2] + '-' + dm[1] !== iso) continue;   // chỉ nhận đúng ngày
    const rest = t.slice(dm.index + dm[0].length).replace(/\d{1,2}:\d{2}/g, ' ');
    const n = (rest.match(digits === 1 ? /\b\d\b/g : /\b\d{2}\b/g) || []).slice(0, count);
    if (n.length === count) return n;
  }
  return null;
}
function pickVietlott(html, labelRe, count, max) {
  for (const t of after(html, labelRe)) {
    const dm = DATE_ANY.exec(t);
    if (!dm) continue;
    const ky = /#\s*0*(\d{3,6})/.exec(t);
    const jps = (t.match(/Jackpot\s*\d?\s*:?\s*([\d.,]{6,})/gi) || []).map((x) => (/([\d.,]{6,})/.exec(x) || [])[1]);
    const rest = t.replace(DATE_ANY, ' ').replace(/#\s*\d+/g, ' ').replace(/[\d.,]{6,}/g, ' ').replace(/\d{1,2}:\d{2}/g, ' ');
    const n = (rest.match(/\b\d{2}\b/g) || []).filter((x) => +x >= 1 && +x <= max).slice(0, count);
    if (n.length === count) {
      return { date: dm[3] + '-' + dm[2] + '-' + dm[1], ky: ky ? ky[1].padStart(5, '0') : '', nums: n, jackpot: jps[0] || '', jackpot2: jps[1] || '' };
    }
  }
  return null;
}
function parseExtras(html, iso) {
  const x = {};
  const a = pickDaily(html, /điện\s*toán\s*1\s*\*\s*2\s*\*\s*3/, iso, 6, 1); if (a) x.dt123 = a;
  const b = pickDaily(html, /thần\s*tài\s*4?/, iso, 4, 1); if (b) x.thantai = b;
  const c = pickDaily(html, /điện\s*toán\s*6\s*x\s*36/, iso, 6, 2); if (c) x.dt636 = c;
  const mg = pickVietlott(html, /mega\s*6\s*[x\/]\s*45/, 6, 45); if (mg && mg.date <= iso) x.mega = mg;
  const pw = pickVietlott(html, /power\s*6\s*[x\/]\s*55/, 7, 55); if (pw && pw.date <= iso) x.power = pw;
  return x;
}
async function minhngoc(region, iso) {
  const d = iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4);
  const urls = [];
  // Hôm nay: trang "xổ số trực tiếp" mới có số đang quay; trang theo ngày chỉ có số sau khi quay xong
  if (iso === vnToday()) urls.push('https://www.minhngoc.net.vn/xo-so-truc-tiep/' + MN_SLUG[region] + '.html');
  urls.push('https://www.minhngoc.net.vn/ket-qua-xo-so/' + MN_SLUG[region] + '/' + d + '.html');
  let best = null, lastErr = null, sawPage = false, extras = {};
  for (const u of urls) {
    let html;
    try { html = await get(u); } catch (e) { lastErr = e; continue; }
    sawPage = true;
    let r = parseMinhNgoc(html, region, iso);
    const r2 = parseTableGeneric(html, region, iso);
    if (r2 && filledOf(r2) > filledOf(r)) r = r2;
    if (region === 'bac') extras = Object.assign(parseExtras(html, iso), extras);
    if (r && filledOf(r) > filledOf(best)) best = r;
    if (best && filledOf(best) >= PRIZES[region].reduce((s, x) => s + x[1], 0) * best.provinces.length) break; // đã đủ số
  }
  if (region === 'bac' && !extras.power) {
    try { const p = parseExtras(await get('https://www.minhngoc.net.vn/ket-qua-xo-so/dien-toan-vietlott.html'), iso); if (p.power) extras.power = p.power; if (!extras.mega && p.mega) extras.mega = p.mega; } catch { }
  }
  if (best) return Object.assign(best, { extras });
  if (!sawPage && lastErr) throw lastErr;
  return { provinces: [], extras, note: 'Minh Ngọc chưa có kết quả ngày ' + dmy(iso) };
}

/* ---------------- Nguồn 2: Xổ Số VN (API JSON) ---------------- */
function toArr(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(toArr);
  if (typeof v === 'object') return toArr(v.number ?? v.value ?? v.so ?? v.num ?? '');
  return String(v).split(/[\s,;|]+/).map((x) => x.trim()).filter(Boolean);
}
const PKEYS = { g8: ['g8', 'giai8'], g7: ['g7', 'giai7'], g6: ['g6', 'giai6'], g5: ['g5', 'giai5'], g4: ['g4', 'giai4'], g3: ['g3', 'giai3'], g2: ['g2', 'giai2'], g1: ['g1', 'giai1'], db: ['db', 'gdb', 'giaidb', 'special'] };
function isRec(o) { return o && typeof o === 'object' && !Array.isArray(o) && ('db' in o || 'g1' in o || 'giaidb' in o); }
function collect(node, parent, out) {
  if (Array.isArray(node)) { node.forEach((x) => collect(x, parent, out)); return; }
  if (!node || typeof node !== 'object') return;
  if (isRec(node)) { out.push({ rec: node, parent }); return; }
  for (const k of Object.keys(node)) if (node[k] && typeof node[k] === 'object') collect(node[k], node, out);
}
async function xosovnm(region, iso) {
  const base = 'https://api.xosovnm.net/api';
  const reg = MN_SLUG[region];
  const urls = [];
  if (iso === vnToday()) urls.push(base + '/live/today?' + new URLSearchParams({ region: reg }));
  urls.push(base + '/lottery/region/' + reg + '?' + new URLSearchParams({ date: dmy(iso), limit: '10' }));
  let lastErr = null;
  for (const u of urls) {
    let j;
    try { j = await get(u, true); } catch (e) { lastErr = e; continue; }
    const found = [];
    collect(j && (j.data !== undefined ? j.data : j), null, found);
    const len = LEN[region], provinces = [];
    let kyhieu = [];
    for (const { rec, parent } of found) {
      const date = (parent && parent.date) || rec.date;
      if (date && String(date).slice(0, 10) !== dmy(iso)) continue;
      const prizes = {};
      PRIZES[region].forEach(([id]) => {
        const k = PKEYS[id].find((x) => rec[x] !== undefined);
        if (k) prizes[id] = toArr(rec[k]).filter((x) => /^\d+$/.test(x) && (!len[id] || x.length === len[id]));
      });
      const name = rec.city || rec.cityName || (parent && (parent.cityName || parent.city)) || '';
      if (region === 'bac' && rec.madb) kyhieu = String(rec.madb).split(/[\s,;|-]+/).filter(Boolean);
      provinces.push({ name: String(name), code: region === 'bac' ? '' : String(rec.madb || rec.code || ''), prizes });
    }
    if (provinces.length) return region === 'bac' ? { provinces: provinces.slice(0, 1), kyhieu } : { provinces };
  }
  if (lastErr) throw lastErr;
  return { provinces: [], note: 'Xổ Số VN chưa có kết quả ngày ' + dmy(iso) };
}

const FETCHERS = { minhngoc, xosovnm };

/* ---------------- Gộp vào dữ liệu đang có ---------------- */
function countFilled(p) { return Object.values(p.prizes || {}).reduce((s, a) => s + (a || []).filter(Boolean).length, 0); }
function mergeRegion(doc, region, got) {
  const cur = (doc[region] && doc[region].provinces) || [];
  const src = got.provinces || [];
  if (!src.length) return 0;
  let changed = 0;
  const out = [];
  const list = region === 'bac' ? [src[0]] : src;
  list.forEach((sp, i) => {
    const old = region === 'bac' ? (cur[0] || {}) : (cur.find((p) => slug(p.name) === slug(sp.name)) || {});
    const p = { name: old.name || sp.name || (cur[i] && cur[i].name) || '', code: sp.code || old.code || '', prizes: {} };
    PRIZES[region].forEach(([id, n]) => {
      const a = (old.prizes && old.prizes[id]) || [], b = (sp.prizes && sp.prizes[id]) || [], r = [];
      for (let k = 0; k < n; k++) {
        const v = b[k] || a[k] || '';
        if (v !== (a[k] || '')) changed++;
        r.push(v);
      }
      p.prizes[id] = r;
    });
    out.push(p);
  });
  // Giữ các đài theo lịch/nhập tay mà nguồn chưa có, và giữ đúng thứ tự cột như trên bảng
  if (region !== 'bac') {
    cur.forEach((p) => { if (!out.some((q) => slug(q.name) === slug(p.name)) && countFilled(p)) out.push(p); });
    const pos = (p) => { const i = cur.findIndex((c) => slug(c.name) === slug(p.name)); return i < 0 ? 99 : i; };
    out.sort((a, b) => pos(a) - pos(b));
  }
  doc[region] = Object.assign({}, doc[region], { provinces: out });
  if (region === 'bac' && got.kyhieu && got.kyhieu.length) {
    const kh = got.kyhieu.slice(0, 6);
    if (JSON.stringify(kh) !== JSON.stringify(doc.bac.kyhieu || [])) { doc.bac.kyhieu = kh; changed++; }
  }
  return changed;
}

function mergeExtras(doc, x) {
  let c = 0;
  ['dt123', 'thantai', 'dt636'].forEach((k) => {
    if (x[k] && JSON.stringify(x[k]) !== JSON.stringify(doc[k] || [])) { doc[k] = x[k]; c++; }
  });
  doc.vietlott = doc.vietlott || {};
  ['mega', 'power'].forEach((k) => {
    if (x[k] && JSON.stringify(x[k]) !== JSON.stringify(doc.vietlott[k] || null)) { doc.vietlott[k] = x[k]; c++; }
  });
  return c;
}

/* ---------------- Cấu hình nguồn ---------------- */
export const SRC_DEFAULT = { mode: 'minhngoc', fallback: true };
export async function getSrc() {
  try { return Object.assign({}, SRC_DEFAULT, JSON.parse((await redis('GET', K.src)) || '{}')); } catch { return { ...SRC_DEFAULT }; }
}

// Lấy kết quả 1 ngày cho các miền chỉ định; lưu vào Redis nếu có thay đổi (trừ khi dry = true)
export async function syncDay(iso, opts = {}) {
  if (!DATE_RE.test(iso)) throw new Error('Ngày không hợp lệ');
  const cfg = opts.cfg || await getSrc();
  const mode = opts.mode || cfg.mode;
  if (!FETCHERS[mode]) return { ok: false, skipped: true, message: 'Đang tắt lấy kết quả tự động' };
  const order = [mode].concat(cfg.fallback ? Object.keys(FETCHERS).filter((m) => m !== mode) : []);
  const regions = opts.regions || REGIONS;

  let doc = opts.doc;
  if (doc === undefined) { const raw = await redis('GET', K.day(iso)); try { doc = raw ? JSON.parse(raw) : null; } catch { doc = null; } }
  doc = doc && typeof doc === 'object' ? doc : { date: iso, nam: { provinces: [] }, trung: { provinces: [] }, bac: { provinces: [], kyhieu: [] }, dt123: [], thantai: [] };
  doc.date = iso; doc.bac = doc.bac || { provinces: [], kyhieu: [] };
  const wd = new Date(iso + 'T00:00:00Z').getUTCDay();
  REGIONS.forEach((r) => {
    doc[r] = doc[r] || { provinces: [] };
    if (!doc[r].provinces || !doc[r].provinces.length) doc[r].provinces = SCHEDULE[wd][r].map((n) => ({ name: n, code: '', prizes: {} }));
  });

  const doneBefore = REGIONS.filter((r) => regionDone(doc, r));
  const report = {};
  let changed = 0;
  const results = await Promise.all(regions.map(async (r) => {
    const errs = [];
    for (const m of order) {
      try { const got = await FETCHERS[m](r, iso); return { r, m, got, errs }; }
      catch (e) { errs.push(SOURCES[m].label + ': ' + e.message); }
    }
    return { r, m: null, got: null, errs };
  }));
  for (const { r, m, got, errs } of results) {
    if (!got) { report[r] = { ok: false, error: errs.join(' | ') }; continue; }
    let c = mergeRegion(doc, r, got);
    if (r === 'bac' && got.extras) c += mergeExtras(doc, got.extras);
    changed += c;
    const filled = (doc[r].provinces || []).reduce((s, p) => s + countFilled(p), 0);
    report[r] = { ok: true, source: m, provinces: (got.provinces || []).length, filled, changed: c, note: got.note || (errs.length ? 'Nguồn chính lỗi, đã dùng nguồn dự phòng: ' + errs.join(' | ') : '') };
  }
  if (changed && !opts.dry) {
    doc.updatedAt = new Date().toISOString();
    doc.autoSource = mode;
    const t = JSON.stringify(doc);
    await pipeline([['SET', K.day(iso), t], ['HSET', K.sizes, iso, String(Buffer.byteLength(t))], ['SADD', K.dirty, iso]]);
    await saveDayIfDone(iso, doc, doneBefore);
  }
  const status = { at: new Date().toISOString(), date: iso, mode, changed, report };
  if (!opts.dry && (changed || Object.values(report).some((x) => !x.ok))) { try { await redis('SET', K.srcStat, JSON.stringify(status)); } catch { } }
  return { ok: true, doc, ...status };
}

/* ---------------- Tự lưu vào thư mục data/ trên GitHub khi một miền vừa quay xong ---------------- */
export async function saveDayIfDone(iso, doc, doneBefore) {
  try {
    const now = REGIONS.filter((r) => regionDone(doc, r));
    const fresh = now.filter((r) => !(doneBefore || []).includes(r));
    if (!fresh.length || !ghConf()) return false;
    const names = { nam: 'Miền Nam', trung: 'Miền Trung', bac: 'Miền Bắc' };
    await ghCommit([{ path: 'data/' + iso + '.json', content: JSON.stringify(doc, null, 1) + '\n' }],
      'Lưu kết quả ' + fresh.map((r) => names[r]).join(', ') + ' ngày ' + dmy(iso));
    if (now.length === REGIONS.length) await redis('SREM', K.dirty, iso);
    return true;
  } catch { return false; }
}
export { regionDone };

/* ---------------- Tự lấy khi có người đang xem (gọi từ /api/results) ---------------- */
function vnClock() {
  const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
  return (+p.hour) * 60 + (+p.minute);
}
function regionDone(doc, r) {
  const ps = doc && doc[r] && doc[r].provinces;
  if (!ps || !ps.length) return false;
  // Miền Bắc chỉ coi là xong khi có cả Điện toán 1*2*3 và Thần Tài
  if (r === 'bac' && (((doc.dt123 || []).filter(Boolean).length < 6) || ((doc.thantai || []).filter(Boolean).length < 4))) return false;
  return ps.every((p) => PRIZES[r].every(([id, n]) => ((p.prizes && p.prizes[id]) || []).filter(Boolean).length >= n));
}
// Trả về danh sách miền cần lấy lúc này và khoảng nghỉ (giây)
export function dueRegions(doc) {
  const now = vnClock(), due = [];
  for (const r of REGIONS) {
    if (regionDone(doc, r)) continue;
    const d = DRAW[r][0] * 60 + DRAW[r][1];
    if (now >= d - 2 && now <= d + 45) due.push([r, 6]);          // đang quay: 6 giây/lần
    else if (now > d + 45 && now <= 23 * 60 + 59) due.push([r, 120]); // quay xong mà chưa đủ số: 2 phút/lần
  }
  return due;
}
export async function autoSync(iso, doc) {
  if (iso !== vnToday()) return null;
  const due = dueRegions(doc);
  if (!due.length) return null;
  const locks = await pipeline(due.map(([r, sec]) => ['SET', K.lock(r), '1', 'NX', 'EX', String(sec)]));
  const regions = due.filter((x, i) => locks[i] === 'OK').map((x) => x[0]);
  if (!regions.length) return null;
  const cfg = await getSrc();
  if (!FETCHERS[cfg.mode]) return null;
  return syncDay(iso, { cfg, regions, doc: doc ? JSON.parse(JSON.stringify(doc)) : null });
}
