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

// تنظيف مفتاح VAPID: إزالة المسافات والاقتباسات، وتحويل base64 العادي إلى base64url
export function cleanKey(k) {
  return String(k || '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// فحص صلاحية المفاتيح: يعيد وصف المشكلة بالعربية، أو نصًا فارغًا إذا كانت سليمة
export function vapidProblem({ publicKey, privateKey }) {
  try {
    const pub = unb64(publicKey), prv = unb64(privateKey);
    if (pub.length !== 65 || pub[0] !== 4) return 'المفتاح العام يجب أن يكون 65 بايت بصيغة base64url';
    if (prv.length !== 32) return 'المفتاح الخاص يجب أن يكون 32 بايت بصيغة base64url';
    crypto.createPrivateKey({
      key: { kty: 'EC', crv: 'P-256', x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: b64u(prv) },
      format: 'jwk',
    });
    return '';
  } catch {
    return 'المفتاحان غير متطابقين أو غير صالحين';
  }
}

// تحليل رد خدمة الدفع الفاشل: dead = الاشتراك منتهٍ ويُحذف (404/410)
export async function pushFailure(res) {
  let reason = '';
  try { reason = String(await res.text()).slice(0, 200); } catch {}
  return { status: res.status, reason, dead: res.status === 404 || res.status === 410 };
}
