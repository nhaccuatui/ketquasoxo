// Tải file nhạc mp3 từ trang admin lên Vercel Blob (tải thẳng từ trình duyệt, không giới hạn 4,5 MB)
// và xóa file nhạc khi admin xóa bài: POST {action:"delete", url} (Bearer mật khẩu admin)
import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { authRole, fail, readBody, requireAdmin, sendJson } from './_lib.js';

const TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { message: 'Chỉ nhận POST' });
  const body = readBody(req) || {};
  try {
    if (body.action === 'delete') {
      if (!(await requireAdmin(req, res))) return;
      if (/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(String(body.url || ''))) await del(body.url);
      return sendJson(res, 200, { ok: true });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) return sendJson(res, 503, { message: 'Chưa kết nối Vercel Blob (thiếu BLOB_READ_WRITE_TOKEN).' });
    const json = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let pw = ''; try { pw = JSON.parse(clientPayload || '{}').pw || ''; } catch { }
        if ((await authRole(pw)) !== 'admin') throw new Error('Sai mật khẩu.');
        if (!/^music\//.test(pathname)) throw new Error('Sai thư mục tải lên.');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: 50 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => { }
    });
    sendJson(res, 200, json);
  } catch (e) {
    if (e && e.code === 'NO_REDIS') return fail(res, e);
    sendJson(res, 400, { message: (e && e.message) || 'Lỗi tải lên' });
  }
}
