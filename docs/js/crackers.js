// Deepawali crackers: rockets that rise and burst into sparks over the app.
// A transparent canvas that never takes taps (pointer-events: none). Pauses while the app is hidden,
// keeps the number of sparks small for phones, and is never started for people who prefer reduced motion.
// Bright colours glow on the dark theme; deeper ones stand out on the light cream background.
const BRIGHT = ['#ffb300', '#ff7043', '#ff4081', '#ffd54f', '#69f0ae', '#40c4ff', '#e040fb', '#fff176'];
const DEEP = ['#e65100', '#d81b60', '#c62828', '#f9a825', '#2e7d32', '#1565c0', '#8e24aa', '#ff6f00'];
let COLORS = DEEP, dark = false;
function readTheme() {
  const m = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [255, 255, 255];
  dark = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128;
  COLORS = dark ? BRIGHT : DEEP;
}
const MAX_SPARKS = 700;
let canvas = null, ctx = null, raf = 0, last = 0, nextLaunch = 0, rockets = [], sparks = [], dpr = 1;

export const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const crackersRunning = () => !!canvas;

function size() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

function launch(x = rand(innerWidth * 0.1, innerWidth * 0.9)) {
  readTheme();
  rockets.push({ x, y: innerHeight + 4, vx: rand(-0.6, 0.6), vy: -rand(innerHeight * 0.011, innerHeight * 0.015) - 6, color: pick(COLORS), top: rand(innerHeight * 0.12, innerHeight * 0.45) });
}
function explode(r) {
  const n = Math.min(70, Math.max(0, MAX_SPARKS - sparks.length)), c2 = pick(COLORS), ring = Math.random() < 0.35;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.05, 0.05), sp = ring ? 4.2 : rand(1, 5);
    sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: rand(0.010, 0.018), color: i % 3 ? r.color : c2 });
  }
  canvas.dataset.bursts = String(Number(canvas.dataset.bursts || 0) + 1);
}

function frame(t) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min((t - (last || t)) / 16.7, 3);
  last = t;
  if (t >= nextLaunch) { launch(); nextLaunch = t + rand(700, 1500); }
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
  for (let i = rockets.length - 1; i >= 0; i--) {
    const r = rockets[i];
    r.x += r.vx * dt; r.y += r.vy * dt; r.vy += 0.12 * dt;
    ctx.fillStyle = r.color;
    ctx.beginPath(); ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,.5)';
    ctx.fillRect(r.x - 0.75, r.y + 3, 1.5, 9);
    if (r.y <= r.top || r.vy >= 0) { explode(r); rockets.splice(i, 1); }
  }
  ctx.lineCap = 'round';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.px = s.x; s.py = s.y;
    s.vx *= 0.985; s.vy = s.vy * 0.985 + 0.045 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.life -= s.decay * dt;
    if (s.life <= 0) { sparks.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(s.life, 0);
    ctx.strokeStyle = ctx.fillStyle = s.color; ctx.lineWidth = 2.4;
    ctx.shadowColor = s.color; ctx.shadowBlur = dark ? 0 : 6;
    ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over';
}
function onVisibility() {
  if (!canvas) return;
  if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
  else if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
}

export function startCrackers() {
  if (canvas || reducedMotion()) return;
  canvas = Object.assign(document.createElement('canvas'), { id: 'crackers', className: 'crackers' });
  canvas.setAttribute('aria-hidden', 'true');
  canvas.dataset.bursts = '0';
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  size();
  addEventListener('resize', size);
  document.addEventListener('visibilitychange', onVisibility);
  nextLaunch = 0;
  for (let i = 0; i < 3; i++) setTimeout(() => canvas && launch(), i * 250);
  if (!document.hidden) raf = requestAnimationFrame(frame);
}
export function stopCrackers() {
  if (!canvas) return;
  cancelAnimationFrame(raf); raf = 0;
  removeEventListener('resize', size);
  document.removeEventListener('visibilitychange', onVisibility);
  canvas.remove();
  canvas = ctx = null; rockets = []; sparks = [];
}
// A big salvo across the screen.
export function burstCrackers(n = 7) {
  if (!canvas) return;
  for (let i = 0; i < n; i++) setTimeout(() => canvas && launch(innerWidth * (0.1 + 0.8 * (i + 0.5) / n)), i * 120);
}
