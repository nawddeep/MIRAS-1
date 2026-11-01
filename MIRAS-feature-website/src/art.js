// Hand-drawn style line art (stroke only, ink blue) for cards and icons.
// Each drawing is a list of SVG elements; strokes are drawn in on scroll.

const svg = (vb, body, cls = 'draw') =>
  `<svg class="${cls}" viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const P = (d) => `<path d="${d}"/>`;
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i)).join('');

// small helpers
const dome = (x, y, r, h = r * 1.1) =>
  P(`M${x - r} ${y} Q${x - r} ${y - h} ${x} ${y - h * 1.15} Q${x + r} ${y - h} ${x + r} ${y}`) +
  P(`M${x} ${y - h * 1.15} V${y - h * 1.15 - 5}`) + P(`M${x - r - 2} ${y} H${x + r + 2}`);
const arch = (x, y, w, h) => P(`M${x} ${y} V${y - h + w / 2} Q${x} ${y - h} ${x + w / 2} ${y - h} Q${x + w} ${y - h} ${x + w} ${y - h + w / 2} V${y}`);
const water = (y0, rows, x0 = 8, x1 = 232) =>
  range(rows, (i) => {
    const y = y0 + i * 6;
    const a = x0 + ((i * 37) % 40), b = x1 - ((i * 23) % 50);
    const m = a + (b - a) * (0.35 + ((i * 13) % 20) / 100);
    return P(`M${a} ${y} H${m - 8} M${m + 6} ${y} H${b}`);
  });
const palm = (x, y, h) =>
  P(`M${x} ${y} Q${x + 3} ${y - h / 2} ${x + 1} ${y - h}`) +
  range(7, (i) => {
    const a = -2.7 + i * 0.9, L = 16;
    const ex = x + 1 + Math.cos(a) * L, ey = y - h + Math.sin(a) * L * 0.6 + 6;
    return P(`M${x + 1} ${y - h} Q${(x + 1 + ex) / 2} ${y - h - 6} ${ex.toFixed(1)} ${ey.toFixed(1)}`);
  });
const boat = (x, y, w) =>
  P(`M${x} ${y} Q${x + w / 2} ${y + 9} ${x + w} ${y - 3}`) + P(`M${x + 2} ${y} H${x + w - 2}`) +
  P(`M${x + w * 0.25} ${y} V${y - 12} M${x + w * 0.75} ${y} V${y - 12} M${x + w * 0.2} ${y - 12} H${x + w * 0.8}`);
const bird = (x, y, s = 6) => P(`M${x - s} ${y} Q${x - s / 2} ${y - s * 0.6} ${x} ${y} Q${x + s / 2} ${y - s * 0.6} ${x + s} ${y}`);

export const places = {
  palace: svg('0 0 240 150',
    P('M8 128 H232') +
    P('M30 128 V64 H210 V128') + P('M30 64 H210') + P('M44 64 V44 H196 V64') + P('M44 52 H196') +
    P('M96 44 V30 H144 V44') +
    dome(58, 44, 9) + dome(86, 44, 8) + dome(120, 30, 12) + dome(154, 44, 8) + dome(182, 44, 9) +
    range(8, (i) => arch(40 + i * 21, 92, 10, 18)) +
    range(8, (i) => arch(40 + i * 21, 120, 10, 16)) +
    range(10, (i) => P(`M${52 + i * 14} 58 V50`)) +
    P('M30 100 H210') +
    water(136, 3)
  ),
  pichola: svg('0 0 240 150',
    P('M8 66 Q40 44 74 58 Q104 40 140 54 Q176 38 232 60') +
    P('M138 88 V72 H206 V88') + dome(150, 72, 6) + dome(172, 72, 9) + dome(194, 72, 6) +
    range(5, (i) => arch(144 + i * 12, 88, 6, 10)) +
    P('M134 88 H210') +
    range(4, (i) => P(`M${148 + i * 14} ${94 + i * 0} h8`)) +
    water(100, 7) +
    boat(36, 116, 52) +
    bird(70, 32) + bird(84, 26, 5)
  ),
  jagdish: svg('0 0 240 150',
    range(6, (i) => P(`M${70 - i * 8} ${92 + i * 8} H${170 + i * 8}`)) +
    P('M90 92 V70 H150 V92') +
    P('M100 70 L104 40 Q120 4 136 40 L140 70') +
    P('M110 70 L112 42 Q120 18 128 42 L130 70') +
    P('M104 40 H136 M106 52 H134 M102 62 H138') +
    P('M120 8 V0 M120 2 L130 5 L120 8') +
    dome(76, 92, 12) + P('M64 92 V80 M88 92 V80') +
    arch(112, 92, 16, 16) +
    P('M8 140 H232')
  ),
  bagore: svg('0 0 240 150',
    P('M40 112 V36 H200 V112') + P('M36 36 H204') + P('M40 30 H200 V36') +
    range(4, (i) => {
      const x = 52 + i * 38;
      return P(`M${x} 64 H${x + 22} V82 H${x} Z`) + dome(x + 11, 64, 11, 8) + P(`M${x - 2} 82 H${x + 24} L${x + 20} 88 H${x + 2} Z`);
    }) +
    arch(108, 112, 24, 26) +
    range(5, (i) => arch(48 + i * 32, 54, 8, 12)) +
    range(4, (i) => P(`M${30 - i * 6} ${112 + i * 6} H${210 + i * 6}`)) +
    water(140, 2)
  ),
  fateh: svg('0 0 240 150',
    P('M8 70 Q36 40 70 52 Q96 30 130 50 Q170 34 200 46 Q220 50 232 60') +
    P('M24 70 H220') +
    P('M96 92 Q120 80 150 92') +
    palm(112, 90, 26) + palm(132, 91, 20) +
    P('M150 92 Q156 88 158 92') +
    water(98, 6) +
    boat(170, 118, 34) +
    bird(178, 30) + bird(192, 22, 5) + bird(160, 24, 4)
  ),
  sajjangarh: svg('0 0 240 150',
    P('M8 130 Q50 104 86 84 Q110 66 120 64 Q132 66 156 84 Q192 104 232 130') +
    P('M60 120 Q100 100 120 98 Q150 102 200 122') +
    P('M96 66 V44 H144 V66') + P('M92 66 H148') +
    dome(120, 44, 12) + dome(104, 44, 5) + dome(136, 44, 5) +
    P('M112 66 V30 H128 V66') + range(3, (i) => arch(100 + i * 14, 62, 6, 9)) +
    `<circle cx="188" cy="34" r="12"/>` +
    bird(40, 30) + bird(54, 38, 5) +
    P('M8 140 H232')
  ),
};

export const icons = {
  boat: svg('0 0 64 48', P('M6 30 Q32 42 58 28') + P('M8 30 H56') + P('M16 30 V16 M48 30 V16 M12 16 H52 L48 11 H16 Z') + P('M8 38 H20 M28 40 H44 M50 37 H58'), 'icon'),
  walk: svg('0 0 64 48', P('M10 44 H54') + P('M16 44 V20 Q16 8 32 8 Q48 8 48 20 V44') + P('M22 44 V24 Q22 16 32 16 Q42 16 42 24 V44') + P('M12 36 H52 M14 28 H50'), 'icon'),
  food: svg('0 0 64 48', P('M18 22 H46 L42 42 H22 Z') + P('M46 26 Q54 26 54 32 Q54 38 44 37') + P('M26 16 Q24 11 27 7 M32 16 Q30 10 33 5 M38 16 Q36 11 39 7') + P('M12 44 H52'), 'icon'),
  dance: svg('0 0 64 48', `<circle cx="32" cy="8" r="4"/>` + P('M32 12 V22 M24 16 L32 18 L42 12') + P('M32 22 L16 42 Q32 48 48 42 Z') + P('M20 38 Q32 42 44 38 M24 32 Q32 35 40 32'), 'icon'),
  market: svg('0 0 64 48', P('M8 18 L32 6 L56 18 Z') + P('M8 18 Q14 24 20 18 Q26 24 32 18 Q38 24 44 18 Q50 24 56 18') + P('M14 22 V44 M50 22 V44 M10 44 H54') + `<circle cx="26" cy="34" r="5"/><circle cx="38" cy="34" r="5"/>`, 'icon'),
};

export const star = `<svg class="star" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 0 C10.8 7 13 9.2 20 10 C13 10.8 10.8 13 10 20 C9.2 13 7 10.8 0 10 C7 9.2 9.2 7 10 0 Z" fill="currentColor"/></svg>`;
