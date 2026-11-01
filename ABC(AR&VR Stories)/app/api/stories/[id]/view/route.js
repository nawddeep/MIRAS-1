import { isUser, mutate } from '@/lib/db';
export const runtime = 'nodejs';

export async function POST(req, { params }) {
  const { id } = await params;
  const { viewer } = await req.json().catch(() => ({}));
  if (!isUser(viewer)) return Response.json({ error: 'Unknown user' }, { status: 400 });
  await mutate((db) => {
    const list = db.views[id] || (db.views[id] = []);
    if (!list.includes(viewer)) list.push(viewer);
  });
  return Response.json({ ok: true });
}
