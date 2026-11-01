// Hand-drawn sketch map. No map library is used: pins are placed from the
// approximate coordinates in the data layer onto a simple ink drawing.
// It is labelled as a sketch and is not for navigation.

import { esc } from '../lib/dom.js';

const BOX = { minLat: 24.563, maxLat: 24.612, minLng: 73.632, maxLng: 73.698 };
const W = 800, H = 600;

/** @param {{lat: number, lng: number}} c */
export const project = (c) => ({
  x: ((c.lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * W,
  y: (1 - (c.lat - BOX.minLat) / (BOX.maxLat - BOX.minLat)) * H,
});

/** @param {{lat: number, lng: number}} c */
export const inArea = (c) => c.lat >= BOX.minLat && c.lat <= BOX.maxLat && c.lng >= BOX.minLng && c.lng <= BOX.maxLng;

/** Rough lake outlines, drawn by eye for orientation only. */
const LAKES = [
  { name: 'Lake Pichola', pts: [[24.585, 73.673], [24.582, 73.679], [24.577, 73.681], [24.571, 73.682], [24.566, 73.680], [24.565, 73.674], [24.569, 73.669], [24.575, 73.670], [24.580, 73.668]] },
  { name: 'Fateh Sagar', pts: [[24.607, 73.669], [24.606, 73.678], [24.600, 73.681], [24.594, 73.679], [24.593, 73.672], [24.597, 73.667], [24.603, 73.666]] },
];

/** @param {number[][]} pts */
const smooth = (pts) => {
  const p = pts.map(([lat, lng]) => project({ lat, lng }));
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    d += ` Q${a.x.toFixed(1)} ${a.y.toFixed(1)} ${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2).toFixed(1)}`;
  }
  return d + ' Z';
};

/**
 * @param {{points: Array<{id: string, label: string, lat: number, lng: number, kind?: 'place' | 'maker'}>, activeId?: string | null, you?: {lat: number, lng: number, label: string} | null, title?: string}} o
 */
export function sketchMap({ points, activeId = null, you = null, title = 'Sketch map of Udaipur' }) {
  const lakes = LAKES.map((l) => {
    const c = project({ lat: l.pts.reduce((s, p) => s + p[0], 0) / l.pts.length, lng: l.pts.reduce((s, p) => s + p[1], 0) / l.pts.length });
    return `<path d="${smooth(l.pts)}" fill="rgba(33,63,107,.06)" stroke="#344F76" stroke-width="1.2"/>
      ${[0, 1, 2].map((i) => `<path d="M${c.x - 30 + i * 8} ${c.y + 14 + i * 7} h${26 - i * 6}" stroke="#344F76" stroke-width=".8" opacity=".6"/>`).join('')}
      <text x="${c.x}" y="${c.y}" text-anchor="middle" style="font:italic 500 16px 'Cormorant Garamond',serif;fill:#344F76">${esc(l.name)}</text>`;
  }).join('');
  const pins = points.map((pt) => {
    const { x, y } = project(pt);
    const active = pt.id === activeId;
    const maker = pt.kind === 'maker';
    return `<g class="m-map-pin${active ? ' is-active' : ''}" data-pin="${pt.id}" tabindex="0" role="button" aria-label="${esc(pt.label)}${maker ? ' (maker)' : ''}" aria-pressed="${active}">
      ${maker ? `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" transform="rotate(45 ${x} ${y})" fill="${active ? '#B65C43' : '#fff'}" stroke="#B65C43" stroke-width="1.5"/>` : `<circle cx="${x}" cy="${y}" r="${active ? 9 : 7}"/>`}
      <text x="${x + 12}" y="${y + 4}">${esc(pt.label)}</text>
    </g>`;
  }).join('');
  const me = you && inArea(you) ? (() => {
    const { x, y } = project(you);
    return `<g aria-label="${esc(you.label)}" role="img"><circle cx="${x}" cy="${y}" r="16" fill="rgba(201,79,69,.12)"/><circle cx="${x}" cy="${y}" r="6" fill="#C94F45"/><text x="${x + 12}" y="${y - 10}" style="font:600 12px 'DM Sans',sans-serif;fill:#A63B32">${esc(you.label)}</text></g>`;
  })() : '';
  return `<div class="m-map">
    <svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(title)}">
      <rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="#D6CEC0"/>
      <path d="M40 ${H - 60} q120 -40 220 -20 t260 -30 t240 10" fill="none" stroke="#D6CEC0" stroke-dasharray="3 5"/>
      <path d="M90 60 q40 60 10 140 t30 200" fill="none" stroke="#D6CEC0" stroke-dasharray="3 5"/>
      <g transform="translate(${W - 50} 50)"><path d="M0 -22 L5 0 L0 22 L-5 0 Z" fill="none" stroke="#344F76"/><text y="-28" text-anchor="middle" style="font:600 12px 'DM Sans',sans-serif;fill:#344F76">N</text></g>
      ${lakes}${pins}${me}
    </svg>
    <p class="m-map-legend">Sketch map, not to scale. Positions are approximate; do not use it to navigate.</p>
  </div>`;
}
