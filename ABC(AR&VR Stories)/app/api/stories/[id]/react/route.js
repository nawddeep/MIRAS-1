import { isUser, mutate } from '@/lib/db';
export const runtime = 'nodejs';

const EMOJI = ['😍', '🔥', '👏', '😮', '😂', '🙏'];

/** Quick emoji reaction or a short reply to the story's owner. */
export async function POST(req, { params }) {
  const { id } = await params;
  const { by, emoji, text } = await req.json().catch(() => ({}));
  if (!isUser(by)) return Response.json({ error: 'Unknown user' }, { status: 400 });
  if (!(EMOJI.includes(emoji) || (typeof text === 'string' && text.trim()))) return Response.json({ error: 'Empty reaction' }, { status: 400 });
  const r = { by, ...(emoji ? { emoji } : { text: text.trim().slice(0, 300) }), at: new Date().toISOString() };
  await mutate((db) => { (db.reactions[id] || (db.reactions[id] = [])).push(r); });
  return Response.json({ reaction: r }, { status: 201 });
}
