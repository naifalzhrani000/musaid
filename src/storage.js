// تخزين خارجي متوافق مع S3 (مثل Cloudflare R2 أو Amazon S3 أو Backblaze B2).
// بلا مكتبات خارجية: توقيع SigV4 بوحدة node:crypto المدمجة.
import crypto from 'node:crypto';
import path from 'node:path';

const E = process.env;
export const MAX_VIDEO = 100e6;
export const MAX_RAW = 30e6; // أقصى حجم لفيديو يُرفع إلى القرص المحلي
export const MEDIA_QUOTA = (+E.MEDIA_QUOTA_MB * 1e6) || 700e6; // سقف مساحة الفيديوهات على القرص
// مجلد الفيديوهات على القرص الدائم: بجانب قاعدة البيانات افتراضيًا (مثلًا /var/data/media)
export const mediaDir = () => E.MEDIA_DIR || path.join(path.dirname(E.DB_FILE || 'data.db'), 'media');
export const storageOn = () => !!(E.S3_ENDPOINT && E.S3_BUCKET && E.S3_ACCESS_KEY_ID && E.S3_SECRET_ACCESS_KEY);

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
const sha = d => crypto.createHash('sha256').update(d).digest('hex');

// رابط موقّع مؤقتًا (PUT للرفع من المتصفح، أو GET/HEAD/DELETE من الخادم)
export function presign(method, key, expires = 900) {
  const region = E.S3_REGION || 'auto', u = new URL(E.S3_ENDPOINT);
  // افتراضيًا: المسار يحمل اسم الـ bucket (path-style). S3_VHOST=1 لتفعيل العنوان بالنطاق الفرعي.
  const vhost = E.S3_VHOST === '1', host = vhost ? `${E.S3_BUCKET}.${u.host}` : u.host;
  const path = (vhost ? '' : '/' + enc(E.S3_BUCKET)) + '/' + key.split('/').map(enc).join('/');
  const amz = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''), date = amz.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const q = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${E.S3_ACCESS_KEY_ID}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const qs = Object.keys(q).sort().map(k => `${enc(k)}=${enc(q[k])}`).join('&');
  const canon = [method, path, qs, `host:${host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const sts = ['AWS4-HMAC-SHA256', amz, scope, sha(canon)].join('\n');
  let k = hmac('AWS4' + E.S3_SECRET_ACCESS_KEY, date);
  for (const p of [region, 's3', 'aws4_request']) k = hmac(k, p);
  const sig = crypto.createHmac('sha256', k).update(sts).digest('hex');
  return `${u.protocol}//${host}${path}?${qs}&X-Amz-Signature=${sig}`;
}

// حجم الكائن إن وُجد، أو null
export async function remoteHead(key) {
  const r = await fetch(presign('HEAD', key, 300), { method: 'HEAD' }).catch(() => null);
  if (!r || !r.ok) return null;
  return { size: +r.headers.get('content-length') || 0 };
}

// أول 12 بايتًا من الملف للتحقق من صيغته
export async function remoteHeader(key) {
  const r = await fetch(presign('GET', key, 300), { headers: { Range: 'bytes=0-11' } }).catch(() => null);
  if (!r || !r.ok) return null;
  return Buffer.from(await r.arrayBuffer());
}

export async function remoteDelete(key) {
  await fetch(presign('DELETE', key, 300), { method: 'DELETE' }).catch(() => {});
}
