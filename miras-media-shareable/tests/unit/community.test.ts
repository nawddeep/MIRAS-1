import { afterEach,beforeEach,describe,expect,it } from 'vitest';
import { createCommunity, type Community } from '@/lib/community/store';
import { openDb,type Db } from '@/lib/repos/sqlite';
import { journeyBadges } from '@/lib/community/badges';
import { sameOrigin,limitedBody } from '@/lib/community/http';
import { normalisePhoto } from '@/lib/community/images';
import sharp from 'sharp';
let db:Db,store:Community;
const password='a-unique-test-password-42';
const register=(name:string)=>store.register(name,name,password);
beforeEach(()=>{db=openDb(':memory:');store=createCommunity(db);});
afterEach(()=>{db.close();});

describe('persistent accounts and sessions',()=>{
 it('salts passwords, hashes session tokens, starts private and never returns credentials',async()=>{
  const a=await register('alice'),b=await register('bob');
  expect(a.user.privacy).toBe('private');expect(a.user).not.toHaveProperty('password_hash');
  const rows=db.prepare('SELECT password_hash FROM community_accounts').all() as {password_hash:string}[];
  expect(rows[0].password_hash).not.toBe(rows[1].password_hash);expect(rows[0].password_hash).not.toContain(password);
  expect(store.current(a.token)?.id).toBe(a.user.id);expect(store.current('fake')).toBeUndefined();
  const row=db.prepare('SELECT token_hash FROM community_sessions WHERE user_id=?').get(a.user.id) as {token_hash:string};expect(row.token_hash).not.toBe(a.token);
  expect(createCommunity(db).current(b.token)?.username).toBe('bob');
 });
 it('rejects wrong credentials, duplicate usernames and revoked sessions',async()=>{
  const a=await register('alice');await expect(store.login('alice','incorrect')).rejects.toThrow('incorrect');
  await expect(store.login('unknown','incorrect')).rejects.toThrow('incorrect');await expect(register('ALICE')).rejects.toThrow('different username');
  store.logout(a.token);expect(store.current(a.token)).toBeUndefined();
 });
 it('rotates recovery codes, revokes every session and refuses reuse',async()=>{
  const a=await register('alice'),other=await store.login('alice',password);
  const recovered=await store.reset('alice',a.recoveryCode,'new-long-password-123');
  expect(store.current(a.token)).toBeUndefined();expect(store.current(other.token)).toBeUndefined();expect(store.current(recovered.token)?.username).toBe('alice');
  expect(recovered.recoveryCode).not.toBe(a.recoveryCode);await expect(store.reset('alice',a.recoveryCode,password)).rejects.toThrow('incorrect');
  await expect(store.login('alice',password)).rejects.toThrow();expect((await store.login('alice','new-long-password-123')).user.username).toBe('alice');
 });
 it('prevents concurrent recovery-code reuse',async()=>{
  const a=await register('alice');const results=await Promise.allSettled([store.reset('alice',a.recoveryCode,'first-new-password-123'),store.reset('alice',a.recoveryCode,'second-new-password-123')]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 });
 it('changes password and deletes account only with the current password',async()=>{
  const a=await register('alice');await expect(store.changePassword(a.user.id,'bad','new-password-123')).rejects.toThrow();
  const token=await store.changePassword(a.user.id,password,'new-password-123');expect(store.current(a.token)).toBeUndefined();expect(store.current(token)).toBeDefined();
  await expect(store.removeAccount(a.user.id,password)).rejects.toThrow();await store.removeAccount(a.user.id,'new-password-123');expect(store.current(token)).toBeUndefined();
 });
 it('persists rate limits across store instances',()=>{store.limit('test',1);expect(()=>createCommunity(db).limit('test',1)).toThrow('Too many attempts');});
});

describe('privacy and ownership boundaries',()=>{
 it('keeps private posts AND photo bytes inaccessible until follow approval, and revokes on removal',async()=>{
  const a=await register('alice'),b=await register('bob');const id=store.createPost(a.user.id,{kind:'memory',text:'private lake memory',visibility:'public'},Buffer.from('image'));
  expect(store.feed(undefined).posts).toHaveLength(0);expect(()=>store.photo(undefined,id)).toThrow('unavailable');expect(()=>store.photo(b.user.id,id)).toThrow();
  store.follow(b.user.id,'alice');expect(store.requests(a.user.id)[0].username).toBe('bob');expect(store.feed(b.user.id).posts).toHaveLength(0);
  store.resolveRequest(a.user.id,b.user.id,true);expect(store.feed(b.user.id).posts[0].id).toBe(id);expect(store.photo(b.user.id,id).toString()).toBe('image');
  store.removeFollower(a.user.id,b.user.id);expect(()=>store.photo(b.user.id,id)).toThrow();expect(store.feed(b.user.id).posts).toHaveLength(0);
 });
 it('enforces only-me posts even for approved followers and public profiles',async()=>{
  const a=await register('alice'),b=await register('bob');store.update(a.user.id,{name:'Alice',bio:'hello',privacy:'public'});store.follow(b.user.id,'alice');
  const id=store.createPost(a.user.id,{kind:'memory',text:'only me',visibility:'private'},Buffer.from('private'));
  expect(store.feed(b.user.id).posts).toHaveLength(0);expect(()=>store.like(b.user.id,id,true)).toThrow();expect(()=>store.comment(b.user.id,id,'leak')).toThrow();expect(()=>store.comments(b.user.id,id)).toThrow();expect(()=>store.report(b.user.id,id,'guessing')).toThrow();
  store.deletePost(b.user.id,id);expect(store.feed(a.user.id).posts).toHaveLength(1);
 });
 it('persists likes/comments, enforces comment ownership, and removes blocked follow relationships',async()=>{
  const a=await register('alice'),b=await register('bob');store.update(a.user.id,{name:'Alice',bio:'',privacy:'public'});store.follow(b.user.id,'alice');
  const id=store.createPost(a.user.id,{kind:'suggestion',text:'Try the lakeside',visibility:'public'});
  store.like(b.user.id,id,true);store.like(b.user.id,id,true);expect(store.feed(b.user.id).posts[0].likes).toBe(1);store.comment(b.user.id,id,'Lovely');
  const comment=store.comments(b.user.id,id)[0];store.deleteComment(a.user.id,comment.id);expect(store.comments(b.user.id,id)).toHaveLength(1);
  store.block(a.user.id,'bob',true);expect(store.feed(b.user.id).posts).toHaveLength(0);expect(()=>store.profile(b.user.id,'alice')).toThrow();expect(store.followers(a.user.id)).toHaveLength(0);
  store.block(a.user.id,'bob',false);expect(store.feed(b.user.id).posts).toHaveLength(1);expect(store.followers(a.user.id)).toHaveLength(0);
 });
 it('expires stories and hides reported photos when a moderator removes the post',async()=>{
  const a=await register('alice'),b=await register('bob');store.update(a.user.id,{name:'Alice',bio:'',privacy:'public'});
  const story=store.createPost(a.user.id,{kind:'story',text:'Yesterday',visibility:'public'},Buffer.from('image'));
  db.prepare('UPDATE community_posts SET created_at=? WHERE id=?').run(new Date(Date.now()-86400001).toISOString(),story);expect(()=>store.photo(a.user.id,story)).toThrow();expect(store.feed(a.user.id).posts).toHaveLength(0);
  const id=store.createPost(a.user.id,{kind:'memory',text:'Reported',visibility:'public'},Buffer.from('image'));store.report(b.user.id,id,'needs review');expect(store.reports()).toHaveLength(1);store.moderate(id,true);expect(store.feed(a.user.id).posts).toHaveLength(0);expect(()=>store.photo(a.user.id,id)).toThrow();expect(store.reports()).toHaveLength(0);
 });
 it('cascades account deletion through posts, photos, comments and relationships',async()=>{
  const a=await register('alice'),b=await register('bob');store.update(a.user.id,{name:'Alice',bio:'',privacy:'public'});const id=store.createPost(a.user.id,{kind:'memory',text:'will delete',visibility:'public'},Buffer.from('bytes'));store.like(b.user.id,id,true);store.comment(b.user.id,id,'comment');store.follow(b.user.id,'alice');
  await store.removeAccount(a.user.id,password);expect(store.feed(b.user.id).posts).toHaveLength(0);expect(()=>store.photo(b.user.id,id)).toThrow();expect(db.prepare('SELECT * FROM community_comments').all()).toHaveLength(0);expect(db.prepare('SELECT * FROM community_likes').all()).toHaveLength(0);
 });
});

describe('journeys, requests and image boundaries',()=>{
 it('limits journeys to one per day, enforces record ownership and recalculates milestones',async()=>{
  const a=await register('alice'),b=await register('bob');store.addJourney(a.user.id,{day:'2026-10-30',placeIds:['city-palace'],note:'Visited'});
  expect(()=>store.addJourney(a.user.id,{day:'2026-10-30',placeIds:['city-palace'],note:''})).toThrow('already recorded');
  const journey=store.journeys(a.user.id)[0];expect(store.journeys(b.user.id)).toHaveLength(0);expect(journeyBadges([journey],0)[0].earned).toBe(true);
  store.deleteJourney(b.user.id,journey.id);expect(store.journeys(a.user.id)).toHaveLength(1);store.deleteJourney(a.user.id,journey.id);expect(journeyBadges(store.journeys(a.user.id),0)[0].earned).toBe(false);
 });
 it('rejects cross-site, missing-origin and oversized bodies',async()=>{
  expect(()=>sameOrigin(new Request('https://miras.example/api/account',{headers:{origin:'https://attacker.example'}}))).toThrow();expect(()=>sameOrigin(new Request('https://miras.example/api/account'))).toThrow();
  expect(()=>sameOrigin(new Request('https://miras.example/api/account',{headers:{origin:'https://miras.example'}}))).not.toThrow();
  await expect(limitedBody(new Request('https://miras.example',{method:'POST',body:'a'.repeat(200)}),100)).rejects.toThrow('large');
 });
 it('rejects fake/SVG photos and strips metadata from valid images',async()=>{
  await expect(normalisePhoto(Buffer.from('<svg></svg>'))).rejects.toThrow('valid');await expect(normalisePhoto(Buffer.from('not-an-image'))).rejects.toThrow();
  const jpeg=await sharp({create:{width:30,height:20,channels:3,background:'red'}}).jpeg().withMetadata().toBuffer();const webp=await normalisePhoto(jpeg);const meta=await sharp(webp).metadata();expect(meta.format).toBe('webp');expect(meta.exif).toBeUndefined();
 });
});
