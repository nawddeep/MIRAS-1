import fs from 'node:fs/promises';
import path from 'node:path';
import { mutate, UPLOAD_DIR } from '@/lib/db';

export const runtime = 'nodejs';

/** Delete your own story (mock stories can't be deleted). */
export async function DELETE(req, { params }) {
  const { id } = await params;
  const { userId } = await req.json().catch(() => ({}));
  const removed = await mutate((db) => {
    const s = db.stories.find((x) => x.id === id);
    if (!s || s.userId !== userId) return null;
    db.stories = db.stories.filter((x) => x.id !== id);
    delete db.views[id]; delete db.reactions[id];
    return s;
  });
  if (!removed) return Response.json({ error: 'Not found or not yours' }, { status: 404 });
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(removed.src))).catch(() => {});
  return Response.json({ ok: true });
}
