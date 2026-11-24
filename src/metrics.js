// قياس أداء الخادم في الذاكرة (بدون مكتبات خارجية). يُصفَّر عند إعادة التشغيل.
import {monitorEventLoopDelay} from 'node:perf_hooks';

const MIN = 60000, KEEP = 60;           // 60 دقيقة من الشرائح
const buckets = new Map();               // minuteStart -> {req,e4,e5,ms}
const routes = new Map();                // "GET /api/x/:id" -> {n,ms,max,e}
const sample = [];                       // آخر 500 زمن استجابة
const SAMPLE_MAX = 500;
const startedAt = Date.now();
let total = 0, e4 = 0, e5 = 0, sumMs = 0;

const loop = monitorEventLoopDelay({resolution: 20});
loop.enable();
setInterval(() => loop.reset(), 5 * MIN).unref();

const norm = p => p.replace(/\/\d+/g, '/:id').replace(/\/[0-9a-f]{24,}/gi, '/:token');

export function record(method, pathname, status, ms) {
  total++; sumMs += ms;
  if (status >= 500) e5++; else if (status >= 400) e4++;
  const m = Math.floor(Date.now() / MIN) * MIN;
  let b = buckets.get(m);
  if (!b) {
    b = {req: 0, e4: 0, e5: 0, ms: 0}; buckets.set(m, b);
    for (const k of buckets.keys()) if (k < m - KEEP * MIN) buckets.delete(k);
  }
  b.req++; b.ms += ms; if (status >= 500) b.e5++; else if (status >= 400) b.e4++;
  sample.push(ms); if (sample.length > SAMPLE_MAX) sample.shift();
  const key = method + ' ' + norm(pathname);
  let r = routes.get(key);
  if (!r) { if (routes.size > 300) return; r = {n: 0, ms: 0, max: 0, e: 0}; routes.set(key, r); }
  r.n++; r.ms += ms; if (ms > r.max) r.max = ms; if (status >= 500) r.e++;
}

const r1 = n => Math.round(n * 10) / 10;

export function snapshot() {
  const sorted = [...sample].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0;
  const now = Math.floor(Date.now() / MIN) * MIN, series = [];
  for (let i = 29; i >= 0; i--) {
    const b = buckets.get(now - i * MIN);
    series.push({req: b ? b.req : 0, err: b ? b.e5 : 0});
  }
  const list = [...routes.entries()].map(([k, v]) => ({route: k, n: v.n, avg_ms: r1(v.ms / v.n), max_ms: r1(v.max), errors: v.e}));
  const mem = process.memoryUsage();
  return {
    since: new Date(startedAt).toISOString(),
    requests: total, errors_4xx: e4, errors_5xx: e5,
    error_rate: total ? r1(e5 / total * 100) : 0,
    avg_ms: total ? r1(sumMs / total) : 0,
    p95_ms: r1(p95),
    per_minute: series,
    slow_routes: list.filter(x => x.n >= 3).sort((a, b) => b.avg_ms - a.avg_ms).slice(0, 5),
    error_routes: list.filter(x => x.errors > 0).sort((a, b) => b.errors - a.errors).slice(0, 5),
    memory: {rss: mem.rss, heap_used: mem.heapUsed, heap_total: mem.heapTotal, heap_pct: mem.heapTotal ? Math.round(mem.heapUsed / mem.heapTotal * 100) : 0},
    loop_lag_ms: r1((loop.mean || 0) / 1e6),
    loop_lag_p99_ms: r1((loop.percentile(99) || 0) / 1e6)
  };
}
