// إشعارات الدفع (Web Push) بلا مكتبات خارجية: تشفير RFC 8291 (aes128gcm) وتوقيع VAPID (RFC 8292).
import crypto from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64 = (s) => Buffer.from(String(s), 'base64url');

// Authorization لنقطة النهاية، موقّع بمفتاح VAPID الخاص (ES256)
export function vapidHeader(endpoint, { publicKey, privateKey, subject }) {
  const aud = new URL(endpoint).origin;
  const pub = unb64(publicKey); // 65 بايت: 0x04 || x || y
  const key = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: privateKey },
    format: 'jwk',
  });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }));
  const data = `${head}.${body}`;
  const sig = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64u(sig)}, k=${publicKey}`;
}

// تشفير الحمولة لمشترك واحد (RFC 8291)
export function encryptPayload(p256dh, authSecret, plaintext) {
  const uaPublic = unb64(p256dh);
  const auth = unb64(authSecret);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, auth, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]); // 0x02 = آخر سجل
  const enc = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, enc]);
}

export async function sendWebPush(sub, plaintext, cfg) {
  if (!/^https:\/\//.test(sub.endpoint)) throw new Error('endpoint غير آمن');
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidHeader(sub.endpoint, cfg),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: encryptPayload(sub.p256dh, sub.auth, plaintext),
  });
}

// تنظيف قيمة مفتاح لُصقت من لوحة الاستضافة: مسافات وأسطر جديدة وعلامات اقتباس زائدة
export const cleanKey = (s) => String(s || '').trim().replace(/^["']+|["']+$/g, '').trim();

// يتحقق أن المفتاحين بالصيغة الصحيحة وأنهما زوج واحد. يعيد وصف المشكلة أو '' إن كانا سليمين
export function vapidProblem({ publicKey, privateKey }) {
  try {
    const pub = unb64(publicKey), d = unb64(privateKey);
    if (pub.length !== 65 || pub[0] !== 4) return 'المفتاح العام غير صالح: يجب أن يكون 65 بايت بصيغة base64url ويبدأ بـ 0x04';
    if (d.length !== 32) return 'المفتاح الخاص غير صالح: يجب أن يكون 32 بايت بصيغة base64url';
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(d);
    if (!ecdh.getPublicKey().equals(pub)) return 'المفتاح الخاص لا يطابق المفتاح العام (ليسا من زوج واحد)';
    return '';
  } catch (e) {
    return 'صيغة مفاتيح VAPID غير صالحة: ' + e.message;
  }
}

// يقرأ سبب رفض خدمة الدفع (آبل تعيد JSON فيه reason). dead = اشتراك لا يصلح بعد الآن:
// منتهٍ (404/410) أو أُنشئ بمفتاح VAPID مختلف عن مفتاح الخادم الحالي، ولا يُصلحه إلا إعادة الاشتراك من الجهاز
export async function pushFailure(r) {
  const raw = (await r.text().catch(() => '')).slice(0, 300);
  let reason = '';
  try { reason = String(JSON.parse(raw).reason || ''); } catch {}
  if (!reason) reason = raw.replace(/\s+/g, ' ').trim().slice(0, 120);
  const dead = r.status === 404 || r.status === 410 || /VapidPkHashMismatch|do not correspond to the credentials/i.test(raw);
  return { status: r.status, reason, dead };
}
