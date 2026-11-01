import fs from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { UPLOAD_DIR } from '@/lib/db';

export const runtime = 'nodejs';
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

/** Streams uploaded media with HTTP Range support (needed for video seeking, esp. on iPhone). */
export async function GET(req, { params }) {
  const { name } = await params;
  const safe = path.basename(name);
  const file = path.join(UPLOAD_DIR, safe);
  let stat;
  try { stat = fs.statSync(file); } catch { return new Response('Not found', { status: 404 }); }
  const type = TYPES[safe.split('.').pop().toLowerCase()] || 'application/octet-stream';
  const range = req.headers.get('range');
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? +m[1] : 0;
    let end = m && m[2] ? +m[2] : stat.size - 1;
    if (!m[1] && m[2]) { start = stat.size - +m[2]; end = stat.size - 1; }
    if (start >= stat.size || end >= stat.size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end }));
    return new Response(stream, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { headers: { ...headers, 'Content-Length': String(stat.size) } });
}
