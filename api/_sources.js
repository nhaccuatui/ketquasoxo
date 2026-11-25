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
const filledOf = (r) => (r && r.provinces || []).reduce((s, p) => s + Object.values(p.prizes || {}).reduce((t, a) => t + a.length, 0), 0);
async function minhngoc(region, iso) {
  const d = iso.slice(8, 10) + '-' + iso.slice(5, 7) + '-' + iso.slice(0, 4);
  const urls = [];
  // Hôm nay: trang "xổ số trực tiếp" mới có số đang quay; trang theo ngày chỉ có số sau khi quay xong
  if (iso === vnToday()) urls.push('https://www.minhngoc.net.vn/xo-so-truc-tiep/' + MN_SLUG[region] + '.html');
  urls.push('https://www.minhngoc.net.vn/ket-qua-xo-so/' + MN_SLUG[region] + '/' + d + '.html');
  let best = null, lastErr = null, sawPage = false;
  for (const u of urls) {
    let html;
    try { html = await get(u); } catch (e) { lastErr = e; continue; }
    sawPage = true;
    const r = parseMinhNgoc(html, region, iso);
    if (r && filledOf(r) > filledOf(best)) best = r;
    if (best && filledOf(best) >= PRIZES[region].reduce((s, x) => s + x[1], 0) * best.provinces.length) break; // đã đủ số
  }
  if (best) return best;
  if (!sawPage && lastErr) throw lastErr;
  return { provinces: [], note: 'Minh Ngọc chưa có kết quả ngày ' + dmy(iso) };
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
    const c = mergeRegion(doc, r, got);
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
