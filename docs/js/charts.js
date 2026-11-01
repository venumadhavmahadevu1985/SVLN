// Tiny dependency-free SVG charts. Colors come from CSS variables so they follow light/dark mode.
import { esc, money, moneyShort } from './util.js';

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

// series: [{ name, cls, values[] }] drawn as grouped bars per label.
export function barChart(labels, series, { title = 'Bar chart' } = {}) {
  const W = 420, H = 210, padL = 38, padR = 4, padT = 10, padB = 24;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = niceMax(Math.max(1, ...series.flatMap(s => s.values)));
  // Keep at least 6 slots so a short history doesn't render as a few giant bars.
  const band = iw / Math.max(labels.length, 6), gap = band * 0.3, bw = (band - gap) / series.length;
  let out = '';
  for (let i = 0; i <= 4; i++) {
    const v = (max * i) / 4, y = padT + ih - (v / max) * ih;
    out += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
    out += `<text class="axis" x="${padL - 5}" y="${y + 3.5}" text-anchor="end">${moneyShort(v)}</text>`;
  }
  labels.forEach((label, i) => {
    series.forEach((s, si) => {
      const v = s.values[i] || 0, h = (v / max) * ih;
      const x = padL + i * band + gap / 2 + si * bw;
      out += `<rect class="bar ${s.cls}" x="${x.toFixed(1)}" y="${(padT + ih - h).toFixed(1)}" width="${Math.max(bw - 1, 1).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${esc(label)} · ${esc(s.name)}: ${money(v)}</title></rect>`;
    });
    out += `<text class="axis" x="${(padL + i * band + band / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(label)}</text>`;
  });
  const legend = series.map(s => `<span><i class="swatch bar ${s.cls}"></i>${esc(s.name)}</span>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${out}</svg><div class="legend">${legend}</div>`;
}

// items: [{ label, value, color: '--c1' }]
export function donutChart(items, { centerLabel = 'spent' } = {}) {
  const total = items.reduce((a, x) => a + x.value, 0) || 1;
  const r = 62, c = 2 * Math.PI * r;
  let off = 0, segs = '';
  for (const it of items) {
    const len = (it.value / total) * c;
    const shown = Math.max(len - (items.length > 1 ? 2 : 0), 0.5);
    segs += `<circle cx="90" cy="90" r="${r}" fill="none" stroke-width="24" style="stroke:var(${it.color})" stroke-dasharray="${shown.toFixed(2)} ${(c - shown).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 90 90)"><title>${esc(it.label)}: ${money(it.value)}</title></circle>`;
    off += len;
  }
  const legend = items.map(it => `
    <li><i class="swatch" style="background:var(${it.color})"></i><span class="lg-label">${esc(it.label)}</span>
    <span class="lg-val">${money(it.value)}</span><span class="lg-pct">${Math.round((it.value / total) * 100)}%</span></li>`).join('');
  return `<div class="donut">
    <svg viewBox="0 0 180 180" role="img" aria-label="Spending by category">${segs}
      <text x="90" y="88" text-anchor="middle" class="donut-total">${moneyShort(total)}</text>
      <text x="90" y="106" text-anchor="middle" class="axis">${esc(centerLabel)}</text></svg>
    <ul class="donut-legend">${legend}</ul></div>`;
}
