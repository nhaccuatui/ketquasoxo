// Dùng chung cho các API (file bắt đầu bằng _ không trở thành route)
// Dữ liệu lưu ở Upstash Redis (gói miễn phí 500.000 lệnh/tháng, 256 MB). Không bao giờ tự xóa.
import { createHash, timingSafeEqual, scryptSync, randomBytes } from 'node:crypto';

export const DEFAULT_PASSWORD = '29081989@';
export const LIMIT_BYTES = (Number(process.env.STORAGE_LIMIT_MB) || 256) * 1024 * 1024;
export const K = {
  pw: 'kqxs:pw',
  settings: 'kqxs:settings',
  sizes: 'kqxs:sizes',        // hash: ngày -> số byte
  dirty: 'kqxs:dirty',        // set: các ngày đã đổi, chưa sao lưu GitHub
  lastBackup: 'kqxs:lastbackup',
  day: (d) => 'kqxs:r:' + d
};
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* ---------------- Redis (REST, không cần cài thư viện) ---------------- */
function conf() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const e = new Error('Chưa kết nối Upstash Redis. Vào Vercel → Storage → Upstash for Redis → Connect, rồi Redeploy.');
    e.code = 'NO_REDIS';
    throw e;
  }
  return { url: url.replace(/\/+$/, ''), token };
}
async function call(path, body) {
  const { url, token } = conf();
  const r = await fetch(url + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j && j.error)) throw new Error('Redis: ' + ((j && j.error) || ('HTTP ' + r.status)));
  return j;
}
export async function redis(...cmd) { return (await call('', cmd)).result; }
export async function pipeline(cmds) {
  if (!cmds.length) return [];
  const arr = await call('/pipeline', cmds);
  return arr.map((x) => { if (x.error) throw new Error('Redis: ' + x.error); return x.result; });
}
export function hashToObj(flat) {
  const o = {};
  if (Array.isArray(flat)) for (let i = 0; i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
  else if (flat && typeof flat === 'object') Object.assign(o, flat);
  return o;
}

/* ---------------- Ngày giờ ---------------- */
export function vnToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ---------------- HTTP ---------------- */
export function sendJson(res, code, obj, cache) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(typeof obj === 'string' ? obj : JSON.stringify(obj));
}
export function readBody(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = null; } }
  return b && typeof b === 'object' ? b : null;
}
export function bearer(req) { return String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''); }
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function fail(res, e) {
  sendJson(res, e && e.code === 'NO_REDIS' ? 503 : 500, { message: (e && e.message) || 'Lỗi máy chủ' });
}

/* ---------------- Mật khẩu ---------------- */
const sha = (s) => createHash('sha256').update(String(s)).digest();
export function secretOk(given, ...secrets) {
  if (!given) return false;
  return secrets.filter(Boolean).some((s) => timingSafeEqual(sha(given), sha(s)));
}
export function hashPw(pw) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(String(pw), salt, 32).toString('hex');
}
function checkHash(pw, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = scryptSync(String(pw), salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Trả về 'admin' (toàn quyền), 'push' (chỉ gửi số, dùng PUSH_TOKEN) hoặc null
export async function authRole(given) {
  if (!given) return null;
  const stored = await redis('GET', K.pw);
  if (stored) { if (checkHash(given, stored)) return 'admin'; }
  else if (secretOk(given, DEFAULT_PASSWORD, process.env.ADMIN_PASSWORD)) return 'admin';
  if (secretOk(given, process.env.PUSH_TOKEN)) return 'push';
  return null;
}
// Dùng trong API: trả về true nếu là admin, nếu không thì tự trả lỗi 401
export async function requireAdmin(req, res, given) {
  const role = await authRole(given != null ? given : bearer(req));
  if (role === 'admin') return true;
  await sleep(700); // làm chậm dò mật khẩu
  sendJson(res, 401, { message: 'Sai mật khẩu.' });
  return false;
}

/* ---------------- GitHub (sao lưu) ---------------- */
export function ghConf() {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo: repo.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, ''), branch: process.env.GITHUB_BRANCH || 'main' };
}
async function gh(c, method, path, body, accept) {
  const r = await fetch('https://api.github.com/repos/' + c.repo + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + c.token, Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'kqxs-ducanh', ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (r.status === 404) return null;
  const text = await r.text();
  if (!r.ok) {
    let m = text; try { m = JSON.parse(text).message; } catch { }
    throw new Error('GitHub ' + r.status + ': ' + m);
  }
  if (accept === 'application/vnd.github.raw') return text;
  return text ? JSON.parse(text) : {};
}
// Đọc 1 file (dạng chữ) từ repo; không có thì trả null
export async function ghRead(path) {
  const c = ghConf(); if (!c) return null;
  return gh(c, 'GET', '/contents/' + path + '?ref=' + encodeURIComponent(c.branch), null, 'application/vnd.github.raw');
}
// Liệt kê tên file trong 1 thư mục
export async function ghList(dir) {
  const c = ghConf(); if (!c) return [];
  const a = await gh(c, 'GET', '/contents/' + dir + '?ref=' + encodeURIComponent(c.branch));
  return Array.isArray(a) ? a.map((x) => x.name) : [];
}
// Ghi nhiều file (content = chuỗi) và xóa nhiều file (content = null) trong MỘT lần commit
export async function ghCommit(files, message) {
  const c = ghConf();
  if (!c) throw new Error('Chưa cài GITHUB_TOKEN và GITHUB_REPO trên Vercel.');
  if (!files.length) return { changed: false };
  const ref = await gh(c, 'GET', '/git/ref/heads/' + encodeURIComponent(c.branch));
  if (!ref) throw new Error('Không thấy nhánh "' + c.branch + '" trong repo ' + c.repo + ' (kiểm tra GITHUB_REPO / GITHUB_BRANCH).');
  const head = ref.object.sha;
  const commit = await gh(c, 'GET', '/git/commits/' + head);
  const tree = await gh(c, 'POST', '/git/trees', {
    base_tree: commit.tree.sha,
    tree: files.map((f) => f.content == null
      ? { path: f.path, mode: '100644', type: 'blob', sha: null }
      : { path: f.path, mode: '100644', type: 'blob', content: f.content })
  });
  if (tree.sha === commit.tree.sha) return { changed: false };
  const nc = await gh(c, 'POST', '/git/commits', { message, tree: tree.sha, parents: [head] });
  await gh(c, 'PATCH', '/git/refs/heads/' + encodeURIComponent(c.branch), { sha: nc.sha });
  return { changed: true, commit: nc.sha };
}
