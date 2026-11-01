import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { listStories, MAX_SECONDS, mutate, UPLOAD_DIR, isUser } from '@/lib/db';
import { USERS } from '@/lib/mock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 150 * 1024 * 1024;
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const VIDEO_TYPES = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

export async function GET() {
  return Response.json({ users: USERS, stories: await listStories(), maxSeconds: MAX_SECONDS });
}

/** Upload a story: multipart form with file + metadata. Everything is validated on the server too. */
export async function POST(req) {
  let form;
  try { form = await req.formData(); } catch { return Response.json({ error: 'Expected multipart form data' }, { status: 400 }); }
  const file = form.get('file');
  const userId = String(form.get('userId') || '');
  if (!isUser(userId)) return Response.json({ error: 'Unknown user' }, { status: 400 });
  if (!file || typeof file === 'string') return Response.json({ error: 'No file' }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: 'File is larger than 150 MB' }, { status: 413 });

  const ext = IMAGE_TYPES[file.type] || VIDEO_TYPES[file.type];
  if (!ext) return Response.json({ error: `Unsupported file type ${file.type || ''}. Use JPG, PNG, WEBP, MP4, WEBM or MOV.` }, { status: 415 });
  const mediaType = IMAGE_TYPES[file.type] ? 'image' : 'video';

  const projection = ['equirect', 'pano', 'flat'].includes(form.get('projection')) ? form.get('projection') : 'flat';
  const panoDeg = Math.min(360, Math.max(90, Number(form.get('panoDeg')) || 360));
  const videoLength = Number(form.get('videoLength')) || 0;
  const trimStart = mediaType === 'video' ? Math.max(0, Number(form.get('trimStart')) || 0) : 0;
  // the 60-second rule: photos show 3-60 s; videos play at most 60 s (from trimStart)
  let duration = Number(form.get('duration')) || (mediaType === 'image' ? 8 : MAX_SECONDS);
  if (mediaType === 'video' && videoLength) duration = Math.min(duration, videoLength - trimStart);
  duration = Math.min(MAX_SECONDS, Math.max(mediaType === 'image' ? 3 : 1, duration));

  const id = `s-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const name = `${id}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));

  const story = {
    id, userId, mediaType, projection, panoDeg: projection === 'pano' ? panoDeg : undefined,
    src: `/api/media/${name}`, duration: Math.round(duration * 10) / 10, trimStart,
    caption: String(form.get('caption') || '').slice(0, 160), place: String(form.get('place') || '').slice(0, 60),
    createdAt: new Date().toISOString(),
  };
  await mutate((db) => { db.stories.push(story); });
  return Response.json({ story }, { status: 201 });
}
