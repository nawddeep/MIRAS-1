import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { openDb, type Db } from '@/lib/repos/sqlite';
import { getConfig } from '@/lib/config';

const derive = promisify(scrypt);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const SESSION_DAYS = 30;
export class CommunityError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Member = { id: string; username: string; name: string; bio: string; privacy: 'private' | 'public'; createdAt: string };
type AccountRow = Member & { password_hash: string; recovery_hash: string };
export type Post = { id: string; authorId: string; username: string; name: string; kind: 'memory' | 'story' | 'suggestion'; text: string; visibility: 'public' | 'followers' | 'private'; createdAt: string; hasPhoto: boolean; likes: number; liked: boolean; comments: number };
const columns = 'id, username, name, bio, privacy, created_at AS createdAt';

async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const key = await derive(password, salt, 64) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password: string, encoded: string) {
  const [salt, expected] = encoded.split(':');
  const actual = (await hashPassword(password, salt)).split(':')[1];
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
const dummyHash = `${'a'.repeat(32)}:${'0'.repeat(128)}`;

export function createCommunity(db: Db) {
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS community_accounts (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '', privacy TEXT NOT NULL DEFAULT 'private',
      password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS community_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE, expires INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS community_sessions_user ON community_sessions(user_id);
    CREATE TABLE IF NOT EXISTS community_attempts (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, until INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS community_follows (
      follower TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      target TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      state TEXT NOT NULL, PRIMARY KEY(follower,target), CHECK(follower != target)
    );
    CREATE TABLE IF NOT EXISTS community_blocks (
      blocker TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      target TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      PRIMARY KEY(blocker,target), CHECK(blocker != target)
    );
    CREATE TABLE IF NOT EXISTS community_posts (
      id TEXT PRIMARY KEY, author TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL, text TEXT NOT NULL, visibility TEXT NOT NULL, image BLOB,
      created_at TEXT NOT NULL, hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS community_posts_created ON community_posts(created_at DESC, id);
    CREATE TABLE IF NOT EXISTS community_likes (
      user_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, PRIMARY KEY(user_id,post_id)
    );
    CREATE TABLE IF NOT EXISTS community_comments (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, text TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS community_reports (
      user_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, reason TEXT NOT NULL,
      created_at TEXT NOT NULL, PRIMARY KEY(user_id,post_id)
    );
    CREATE TABLE IF NOT EXISTS community_featured_badges (
      user_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      badge_id TEXT NOT NULL, PRIMARY KEY(user_id,badge_id)
    );
    CREATE TABLE IF NOT EXISTS community_collections (
      user_id TEXT PRIMARY KEY REFERENCES community_accounts(id) ON DELETE CASCADE,
      data TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS community_journeys (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES community_accounts(id) ON DELETE CASCADE,
      day TEXT NOT NULL, place_ids TEXT NOT NULL, trail_id TEXT, note TEXT NOT NULL,
      created_at TEXT NOT NULL, UNIQUE(user_id,day)
    );
  `);
  const member = (id: string) => db.prepare(`SELECT ${columns} FROM community_accounts WHERE id=?`).get(id) as Member | undefined;
  const find = (username: string) => db.prepare(`SELECT ${columns} FROM community_accounts WHERE username=? COLLATE NOCASE`).get(username) as Member | undefined;
  const requiredMember = (id: string) => { const m = member(id); if (!m) throw new CommunityError('Please sign in again.', 401); return m; };
  const blocked = (a: string, b: string) => !!db.prepare('SELECT 1 FROM community_blocks WHERE (blocker=? AND target=?) OR (blocker=? AND target=?)').get(a,b,b,a);
  const approved = (viewer: string, author: string) => !!db.prepare("SELECT 1 FROM community_follows WHERE follower=? AND target=? AND state='approved'").get(viewer,author);
  const canRead = (viewer: string | undefined, post: {author: string; visibility: string; kind: string; created_at: string; hidden: number}) => {
    if (post.hidden || (post.kind === 'story' && Date.now() - Date.parse(post.created_at) >= 86_400_000)) return false;
    if (viewer === post.author) return true;
    const author = member(post.author);
    if (!author || (viewer && blocked(viewer,post.author)) || post.visibility === 'private') return false;
    if (author.privacy === 'private' || post.visibility === 'followers') return !!viewer && approved(viewer,post.author);
    return true;
  };
  const visiblePost = (viewer: string | undefined, id: string) => {
    const post = db.prepare('SELECT id, author, visibility, kind, created_at, hidden FROM community_posts WHERE id=?').get(id) as {id:string;author:string;visibility:string;kind:string;created_at:string;hidden:number} | undefined;
    if (!post || !canRead(viewer,post)) throw new CommunityError('This post is unavailable.',404);
    return post;
  };
  const session = (id: string) => {
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM community_sessions WHERE expires<=?').run(Date.now());
    db.prepare('INSERT INTO community_sessions VALUES (?,?,?)').run(digest(token),id,Date.now()+SESSION_DAYS*86_400_000);
    return token;
  };
  return {
    member, find,
    limit(key: string, max = 10, duration = 900_000) {
      const now = Date.now();
      db.prepare('DELETE FROM community_attempts WHERE until<=?').run(now);
      const row = db.prepare('SELECT hits FROM community_attempts WHERE key=?').get(key) as {hits:number} | undefined;
      if (row && row.hits >= max) throw new CommunityError('Too many attempts. Please try again later.',429);
      db.prepare('INSERT INTO community_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1').run(key,now+duration);
    },
    async register(username: string, name: string, password: string) {
      if (find(username)) throw new CommunityError('Choose a different username.',409);
      const id = randomUUID(), recoveryCode = randomBytes(24).toString('hex');
      const passwordHash = await hashPassword(password);
      try { db.prepare('INSERT INTO community_accounts (id,username,name,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?)').run(id,username,name,passwordHash,digest(recoveryCode),new Date().toISOString()); }
      catch (error) { if (find(username)) throw new CommunityError('Choose a different username.',409); throw error; }
      return { user: requiredMember(id), token: session(id), recoveryCode };
    },
    async login(username: string, password: string) {
      const row = db.prepare(`SELECT ${columns}, password_hash, recovery_hash FROM community_accounts WHERE username=? COLLATE NOCASE`).get(username) as AccountRow | undefined;
      const valid = await passwordMatches(password,row?.password_hash ?? dummyHash);
      if (!row || !valid) throw new CommunityError('Username or password is incorrect.',401);
      return { user: requiredMember(row.id), token: session(row.id) };
    },
    current(token?: string) {
      if (!token || !/^[a-f0-9]{64}$/.test(token)) return undefined;
      const row = db.prepare('SELECT user_id FROM community_sessions WHERE token_hash=? AND expires>?').get(digest(token),Date.now()) as {user_id:string} | undefined;
      return row ? member(row.user_id) : undefined;
    },
    logout(token?: string) { if (token) db.prepare('DELETE FROM community_sessions WHERE token_hash=?').run(digest(token)); },
    update(id: string, value: {name: string;bio: string;privacy: 'private'|'public'}) {
      requiredMember(id);
      db.transaction(()=>{
        db.prepare('UPDATE community_accounts SET name=?,bio=?,privacy=? WHERE id=?').run(value.name,value.bio,value.privacy,id);
        if (value.privacy === 'public') db.prepare("UPDATE community_follows SET state='approved' WHERE target=? AND state='pending'").run(id);
      })();
      return requiredMember(id);
    },
    async reset(username: string, recoveryCode: string, password: string) {
      const row = db.prepare('SELECT id,recovery_hash FROM community_accounts WHERE username=? COLLATE NOCASE').get(username) as {id:string;recovery_hash:string} | undefined;
      const valid = timingSafeEqual(Buffer.from(digest(recoveryCode)),Buffer.from(row?.recovery_hash ?? digest('invalid')));
      if (!row || !valid) throw new CommunityError('Username or recovery code is incorrect.',401);
      const passwordHash = await hashPassword(password), nextCode = randomBytes(24).toString('hex');
      db.transaction(()=>{
        const changed=db.prepare('UPDATE community_accounts SET password_hash=?,recovery_hash=? WHERE id=? AND recovery_hash=?').run(passwordHash,digest(nextCode),row.id,row.recovery_hash);
        if(!changed.changes)throw new CommunityError('Recovery code has already been used.',401);
        db.prepare('DELETE FROM community_sessions WHERE user_id=?').run(row.id);
      })();
      return {user: requiredMember(row.id),token: session(row.id),recoveryCode: nextCode};
    },
    async changePassword(id: string, oldPassword: string, password: string) {
      const row = db.prepare('SELECT password_hash FROM community_accounts WHERE id=?').get(id) as {password_hash:string} | undefined;
      if (!row || !await passwordMatches(oldPassword,row.password_hash)) throw new CommunityError('Current password is incorrect.',401);
      const encoded = await hashPassword(password);
      db.transaction(()=>{const changed=db.prepare('UPDATE community_accounts SET password_hash=? WHERE id=? AND password_hash=?').run(encoded,id,row.password_hash);if(!changed.changes)throw new CommunityError('Password changed. Please sign in again.',401);db.prepare('DELETE FROM community_sessions WHERE user_id=?').run(id);})();
      return session(id);
    },
    async removeAccount(id: string, password: string) {
      const row = db.prepare('SELECT password_hash FROM community_accounts WHERE id=?').get(id) as {password_hash:string} | undefined;
      if (!row || !await passwordMatches(password,row.password_hash)) throw new CommunityError('Current password is incorrect.',401);
      const changed=db.prepare('DELETE FROM community_accounts WHERE id=? AND password_hash=?').run(id,row.password_hash);if(!changed.changes)throw new CommunityError('Password changed. Please sign in again.',401);
    },
    profile(viewer: string | undefined, username: string) {
      const user = find(username);
      if (!user || (viewer && blocked(viewer,user.id))) throw new CommunityError('Profile unavailable.',404);
      const relation = viewer ? db.prepare('SELECT state FROM community_follows WHERE follower=? AND target=?').get(viewer,user.id) as {state:string}|undefined : undefined;
      return {user,relation:relation?.state ?? 'none',canRead:viewer===user.id||user.privacy==='public'||!!viewer&&approved(viewer,user.id),followers:(db.prepare("SELECT COUNT(*) AS n FROM community_follows WHERE target=? AND state='approved'").get(user.id) as {n:number}).n};
    },
    people(viewer: string | undefined, query: string) {
      return (db.prepare(`SELECT ${columns} FROM community_accounts WHERE username LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' ORDER BY username LIMIT 30`).all(...Array(2).fill(`%${query.replace(/[\\%_]/g,'\\$&')}%`)) as Member[]).filter(user=>!viewer||!blocked(viewer,user.id));
    },
    follow(viewer: string, username: string) {
      const target = find(username);
      if (!target || target.id === viewer || blocked(viewer,target.id)) throw new CommunityError('Cannot follow this profile.');
      db.prepare('INSERT OR IGNORE INTO community_follows VALUES (?,?,?)').run(viewer,target.id,target.privacy==='private'?'pending':'approved');
    },
    unfollow(viewer: string, username: string) { const target=find(username);if(target)db.prepare('DELETE FROM community_follows WHERE follower=? AND target=?').run(viewer,target.id); },
    requests(viewer: string) { return db.prepare(`SELECT a.id,a.username,a.name FROM community_follows f JOIN community_accounts a ON a.id=f.follower WHERE f.target=? AND f.state='pending'`).all(viewer) as Pick<Member,'id'|'username'|'name'>[]; },
    resolveRequest(viewer: string, follower: string, approve: boolean) {
      if (approve && !blocked(viewer,follower)) db.prepare("UPDATE community_follows SET state='approved' WHERE target=? AND follower=? AND state='pending'").run(viewer,follower);
      else db.prepare('DELETE FROM community_follows WHERE target=? AND follower=?').run(viewer,follower);
    },
    removeFollower(viewer: string, follower: string) { db.prepare('DELETE FROM community_follows WHERE target=? AND follower=?').run(viewer,follower); },
    block(viewer: string, username: string, value: boolean) {
      const target=find(username);if(!target || target.id===viewer)throw new CommunityError('Profile unavailable.',404);
      db.transaction(()=>{if(value){db.prepare('INSERT OR IGNORE INTO community_blocks VALUES (?,?)').run(viewer,target.id);db.prepare('DELETE FROM community_follows WHERE (follower=? AND target=?) OR (follower=? AND target=?)').run(viewer,target.id,target.id,viewer);}else db.prepare('DELETE FROM community_blocks WHERE blocker=? AND target=?').run(viewer,target.id);})();
    },
    blocks(viewer: string) { return db.prepare('SELECT a.username,a.name FROM community_blocks b JOIN community_accounts a ON a.id=b.target WHERE b.blocker=?').all(viewer) as Pick<Member,'username'|'name'>[]; },
    followers(viewer: string) { return db.prepare("SELECT a.id,a.username,a.name FROM community_follows f JOIN community_accounts a ON a.id=f.follower WHERE f.target=? AND f.state='approved'").all(viewer) as Pick<Member,'id'|'username'|'name'>[]; },
    createPost(viewer: string, value: {kind: Post['kind'];text: string;visibility: Post['visibility']}, image?: Buffer) {
      requiredMember(viewer);
      const count=(db.prepare('SELECT COUNT(*) AS n FROM community_posts WHERE author=?').get(viewer) as {n:number}).n;
      if(count>=500) throw new CommunityError('Your account has reached its 500-post storage limit. Delete an older post first.',409);
      const id=randomUUID();db.prepare('INSERT INTO community_posts (id,author,kind,text,visibility,image,created_at) VALUES (?,?,?,?,?,?,?)').run(id,viewer,value.kind,value.text,value.visibility,image ?? null,new Date().toISOString());return id;
    },
    feed(viewer: string | undefined, username?: string, page=0, postId='', kind='') {
      db.prepare("DELETE FROM community_posts WHERE kind='story' AND created_at<=?").run(new Date(Date.now()-86_400_000).toISOString());
      const v=viewer ?? '';
      const owner=username ? find(username)?.id ?? 'missing' : '';
      const rows=db.prepare(`SELECT p.id,p.author AS authorId,a.username,a.name,p.kind,p.text,p.visibility,p.created_at AS createdAt,p.image IS NOT NULL AS hasPhoto,
        (SELECT COUNT(*) FROM community_likes l WHERE l.post_id=p.id) AS likes,
        EXISTS(SELECT 1 FROM community_likes l WHERE l.post_id=p.id AND l.user_id=@v) AS liked,
        (SELECT COUNT(*) FROM community_comments c WHERE c.post_id=p.id) AS comments
        FROM community_posts p JOIN community_accounts a ON a.id=p.author
        WHERE p.hidden=0 AND (@owner='' OR p.author=@owner) AND (@postId='' OR p.id=@postId) AND (@kind='' OR p.kind=@kind)
        AND (p.kind!='story' OR p.created_at>@yesterday)
        AND NOT EXISTS(SELECT 1 FROM community_blocks b WHERE (b.blocker=@v AND b.target=p.author) OR (b.target=@v AND b.blocker=p.author))
        AND (p.author=@v OR (p.visibility!='private' AND ((a.privacy='public' AND p.visibility='public') OR EXISTS(SELECT 1 FROM community_follows f WHERE f.follower=@v AND f.target=p.author AND f.state='approved'))))
        ORDER BY p.created_at DESC,p.id DESC LIMIT 21 OFFSET @offset`).all({v,owner,yesterday:new Date(Date.now()-86_400_000).toISOString(),offset:page*20,postId,kind}) as (Omit<Post,'hasPhoto'|'liked'> & {hasPhoto:number;liked:number})[];
      return {posts:rows.slice(0,20).map(p=>({...p,hasPhoto:!!p.hasPhoto,liked:!!p.liked})),more:rows.length>20};
    },
    photo(viewer: string | undefined, id: string) { visiblePost(viewer,id);const row=db.prepare('SELECT image FROM community_posts WHERE id=?').get(id) as {image:Buffer|null};if(!row.image)throw new CommunityError('Photo unavailable.',404);return row.image; },
    like(viewer: string, id: string, value: boolean) { visiblePost(viewer,id);if(value)db.prepare('INSERT OR IGNORE INTO community_likes VALUES (?,?)').run(viewer,id);else db.prepare('DELETE FROM community_likes WHERE user_id=? AND post_id=?').run(viewer,id); },
    comments(viewer: string | undefined, id: string) { visiblePost(viewer,id);return db.prepare('SELECT c.id,c.text,c.created_at AS createdAt,a.username,a.name,c.user_id AS authorId FROM community_comments c JOIN community_accounts a ON a.id=c.user_id WHERE c.post_id=? ORDER BY c.created_at LIMIT 100').all(id) as {id:string;text:string;createdAt:string;username:string;name:string;authorId:string}[]; },
    comment(viewer: string, id: string, text: string) { visiblePost(viewer,id);db.prepare('INSERT INTO community_comments VALUES (?,?,?,?,?)').run(randomUUID(),viewer,id,text,new Date().toISOString()); },
    deleteComment(viewer: string, id: string) { db.prepare('DELETE FROM community_comments WHERE id=? AND user_id=?').run(id,viewer); },
    deletePost(viewer: string, id: string) { db.prepare('DELETE FROM community_posts WHERE id=? AND author=?').run(id,viewer); },
    report(viewer: string, id: string, reason: string) { visiblePost(viewer,id);db.prepare('INSERT OR IGNORE INTO community_reports VALUES (?,?,?,?)').run(viewer,id,reason,new Date().toISOString()); },
    reports() { return db.prepare('SELECT r.post_id AS postId,r.reason,r.created_at AS createdAt,p.text,a.username,p.hidden FROM community_reports r JOIN community_posts p ON p.id=r.post_id JOIN community_accounts a ON a.id=p.author ORDER BY r.created_at DESC LIMIT 100').all() as {postId:string;reason:string;createdAt:string;text:string;username:string;hidden:number}[]; },
    moderate(id: string, hide: boolean) { db.transaction(()=>{db.prepare('UPDATE community_posts SET hidden=? WHERE id=?').run(hide?1:0,id);db.prepare('DELETE FROM community_reports WHERE post_id=?').run(id);})(); },
    featured(viewer: string) {return (db.prepare('SELECT badge_id FROM community_featured_badges WHERE user_id=?').all(viewer) as {badge_id:string}[]).map(row=>row.badge_id);},
    feature(viewer: string, ids: string[]) {db.transaction(()=>{db.prepare('DELETE FROM community_featured_badges WHERE user_id=?').run(viewer);const insert=db.prepare('INSERT INTO community_featured_badges VALUES (?,?)');for(const id of new Set(ids))insert.run(viewer,id);})();},
    collection(viewer: string) {const row=db.prepare('SELECT data,updated_at AS updatedAt FROM community_collections WHERE user_id=?').get(viewer) as {data:string;updatedAt:string}|undefined;return row?{data:JSON.parse(row.data) as unknown,updatedAt:row.updatedAt}:null;},
    saveCollection(viewer: string, value: unknown) {db.prepare('INSERT INTO community_collections VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at').run(viewer,JSON.stringify(value),new Date().toISOString());},
    memoryCount(viewer: string) { return (db.prepare("SELECT COUNT(*) AS n FROM community_posts WHERE author=? AND kind='memory' AND visibility!='private' AND hidden=0").get(viewer) as {n:number}).n; },
    journeys(viewer: string) { return (db.prepare('SELECT id,day,place_ids AS placeIds,trail_id AS trailId,note FROM community_journeys WHERE user_id=? ORDER BY day DESC').all(viewer) as {id:string;day:string;placeIds:string;trailId:string|null;note:string}[]).map(row=>({...row,placeIds:JSON.parse(row.placeIds) as string[]})); },
    addJourney(viewer: string, value: {day:string;placeIds:string[];trailId?:string;note:string}) {
      requiredMember(viewer);try{db.prepare('INSERT INTO community_journeys VALUES (?,?,?,?,?,?,?)').run(randomUUID(),viewer,value.day,JSON.stringify([...new Set(value.placeIds)]),value.trailId??null,value.note,new Date().toISOString());}catch(error){if((error as {code?:string}).code==='SQLITE_CONSTRAINT_UNIQUE')throw new CommunityError('A journey is already recorded for this day.',409);throw error;}
    },
    deleteJourney(viewer: string, id: string) { db.prepare('DELETE FROM community_journeys WHERE id=? AND user_id=?').run(id,viewer); },
  };
}
export type Community = ReturnType<typeof createCommunity>;
let community: Community | undefined;
export const getCommunity = () => community ??= createCommunity(openDb(getConfig().dataDir));
