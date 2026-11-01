// Generates neutral placeholder media (gradients and simple shapes, no photos) into public/media/placeholders.
// Run: node scripts/make-placeholders.mjs. Output is committed; rerun only to change the look.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const out = path.join(process.cwd(), "public", "media", "placeholders");
fs.mkdirSync(out, { recursive: true });

const palettes = {
  dusk: ["#8C9CC0", "#E8B9A2", "#F5D7AA", "#3F6B50", "#4A5A82"],
  noon: ["#8FB0D6", "#C9D9EA", "#F3E3D3", "#5C8665", "#8FB0D6"],
  dawn: ["#B7A3B8", "#F5D7AA", "#FFF3E8", "#6E8F78", "#D7B79A"],
};

function sceneSvg(name, [top, mid, hor, hill, water]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
  <defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".6" stop-color="${mid}"/><stop offset="1" stop-color="${hor}"/></linearGradient></defs>
  <rect width="1600" height="900" fill="url(#s)"/>
  <path d="M0 560 C 260 430 420 520 640 470 S 1080 400 1300 480 S 1520 520 1600 500 V 900 H 0 Z" fill="${hill}" opacity=".85"/>
  <rect y="640" width="1600" height="260" fill="${water}" opacity=".75"/>
  <text x="800" y="830" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#131B31" opacity=".55">Placeholder image · ${name}</text>
</svg>\n`;
}

function patternSvg(name, [a, b, c]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" fill="${c}"/>
  <g fill="none" stroke="${a}" stroke-width="18" opacity=".7">
    <circle cx="400" cy="400" r="120"/><circle cx="400" cy="400" r="220"/><circle cx="400" cy="400" r="320"/>
  </g>
  <rect x="340" y="340" width="120" height="120" transform="rotate(45 400 400)" fill="${b}"/>
  <text x="400" y="740" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#131B31" opacity=".6">Placeholder · ${name}</text>
</svg>\n`;
}

const scenes = [
  ["sajjangarh-1", "dusk"],
  ["sajjangarh-2", "dawn"],
  ["pichhola-1", "noon"],
  ["pichhola-2", "dusk"],
  ["city-palace-1", "dawn"],
  ["city-palace-2", "noon"],
];
for (const [name, p] of scenes) fs.writeFileSync(path.join(out, `${name}.svg`), sceneSvg(name, palettes[p]));
for (const [i, p] of [[1, "dusk"], [2, "noon"], [3, "dawn"]]) fs.writeFileSync(path.join(out, `artisan-${i}.svg`), patternSvg(`artisan ${i}`, palettes[p]));

// Equirectangular gradient panorama (2048x1024 PNG) so the 360 viewer has something to show.
function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const W = 2048, H = 1024, horizon = 540;
const [top, mid, hor, hill, water] = palettes.dusk.map(hex);
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const a = (x / W) * Math.PI * 2;
    const ridge = horizon - 40 - 60 * (0.5 + 0.5 * Math.sin(a * 3)) - 25 * Math.sin(a * 7 + 1);
    let c;
    if (y < ridge) c = y < horizon * 0.55 ? mix(top, mid, y / (horizon * 0.55)) : mix(mid, hor, (y - horizon * 0.55) / (horizon * 0.45));
    else if (y < horizon) c = hill;
    else c = mix(water, [19, 27, 49], Math.min(1, (y - horizon) / (H - horizon)) * 0.6);
    const o = y * (W * 3 + 1) + 1 + x * 3;
    raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(
  path.join(out, "pano-placeholder.png"),
  Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]),
);
console.log("Placeholders written to", out);
