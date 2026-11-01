'use client';
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import type { Member,Post } from '@/lib/community/store';
import { communityRequest } from '@/lib/community/client';

type Feed={user:Member|null;posts:Post[];more:boolean;profile:{user:Member;relation:string;canRead:boolean;followers:number;featured:{id:string;title:string}[]}|null};
export function CommunityFeed({username,postId}:{username?:string;postId?:string}){
 const [feed,setFeed]=useState<Feed|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[page,setPage]=useState(0),[tab,setTab]=useState('All'),[busy,setBusy]=useState(false);
 const kind=({Memories:'memory',Stories:'story',Suggestions:'suggestion'} as Record<string,string>)[tab]??'';
 const refresh=useCallback(async()=>{try{setFeed(await communityRequest<Feed>(`/api/community?view=feed&page=${page}${username?`&username=${encodeURIComponent(username)}`:''}${postId?`&postId=${encodeURIComponent(postId)}`:''}${kind?`&kind=${kind}`:''}`));setError('');}catch(e){setError((e as Error).message);}},[page,username,postId,kind]);
 useEffect(()=>{let active=true;communityRequest<Feed>(`/api/community?view=feed&page=${page}${username?`&username=${encodeURIComponent(username)}`:''}${postId?`&postId=${encodeURIComponent(postId)}`:''}${kind?`&kind=${kind}`:''}`).then(data=>{if(active){setFeed(data);setError('');}}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[page,username,postId,kind]);
 async function act(body:Record<string,unknown>){setBusy(true);try{await communityRequest('/api/community',body);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const profile=feed?.profile;
 return <div className="social-screen"><header><p className="social-wordmark">MIRAS</p><h1>{profile?profile.user.name:<>From the city,<br/>with love.</>}</h1>{profile?<><p>@{profile.user.username} · {profile.followers} followers · {profile.user.privacy} profile</p><p>{profile.user.bio}</p></>:<p>Journeys, memories and recommendations from travellers.</p>}</header>
  <nav className="social-account-links"><Link href="/account">{feed?.user?'Account & requests':'Sign in / Create account'}</Link><Link href="/journeys">Journeys & badges</Link></nav>
  {error&&<p role="alert" className="social-error">{error} <button onClick={()=>void refresh()}>Try again</button></p>}{notice&&<p role="status">{notice}</p>}
  {!feed&&!error&&<p role="status">Loading community…</p>}
  {profile&&feed?.user&&feed.user.id!==profile.user.id&&<div className="feature-action-row"><button className="feature-primary" disabled={busy} onClick={()=>void act({action:profile.relation==='none'?'follow':'unfollow',username:profile.user.username})}>{profile.relation==='approved'?'Unfollow':profile.relation==='pending'?'Cancel follow request':'Follow'}</button><details><summary>More profile options</summary><button className="feature-secondary" disabled={busy} onClick={()=>void act({action:'block',username:profile.user.username,blocked:true})}>Block this account</button></details></div>}
  {profile&&!profile.canRead&&<p className="social-private">This profile is private. {profile.relation==='pending'?'Your follow request is awaiting approval.':'Follow to request access to their posts.'}</p>}
  {profile&&profile.featured.length>0&&<section className="social-featured-badges" aria-label="Featured journey milestones">{profile.featured.map(badge=><span key={badge.id}>✧ {badge.title}</span>)}<p className="social-muted">Based on self-recorded journeys.</p></section>}
  {!username&&<PeopleSearch/>}
  {feed?.user&&(!username||username===feed.user.username)&&<PostComposer onCreated={async()=>{if(page===0)await refresh();else setPage(0);setNotice('Your post is saved.');}}/>}
  {feed&&<><div className="journal-tabs" role="group" aria-label="Community post type">{['All','Memories','Stories','Suggestions'].map(name=><button key={name} aria-pressed={tab===name} onClick={()=>{setTab(name);setPage(0);}}>{name}</button>)}</div><p className="social-muted">Stories expire after 24 hours. Visibility also follows each author’s profile settings.</p>
   {feed.posts.filter(post=>(!postId||post.id===postId)&&(tab==='All'||post.kind===({Memories:'memory',Stories:'story',Suggestions:'suggestion'} as Record<string,string>)[tab])).map(post=><CommunityPost key={post.id} post={post} viewer={feed.user?.id} refresh={refresh}/>)}
   {(!feed.posts.length||!feed.posts.some(post=>(!postId||post.id===postId)&&(tab==='All'||post.kind===({Memories:'memory',Stories:'story',Suggestions:'suggestion'} as Record<string,string>)[tab])))&&<section className="social-empty"><h2>{postId?'This post is unavailable.':'No posts here yet.'}</h2><p>{postId?'It may be private, expired or removed.':feed.user?'Share a memory or find someone to follow.':'Sign in to share a memory or follow a private account.'}</p></section>}
   <nav className="feature-action-row" aria-label="Community pages"><button className="feature-secondary" disabled={page===0} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1}</span><button className="feature-secondary" disabled={!feed.more} onClick={()=>setPage(page+1)}>Next</button></nav></>}
 </div>;
}
function PeopleSearch(){
 const [people,setPeople]=useState<Member[]>([]),[error,setError]=useState(''),[searched,setSearched]=useState(false),[busy,setBusy]=useState(false);
 return <section className="social-people"><form onSubmit={async e=>{e.preventDefault();const q=String(new FormData(e.currentTarget).get('q')??'');setBusy(true);try{const data=await communityRequest<{people:Member[]}>(`/api/community?view=people&q=${encodeURIComponent(q)}`);setPeople(data.people);setSearched(true);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><label>Find travellers<input name="q" type="search" maxLength={60} placeholder="Name or username"/></label><button className="feature-secondary" disabled={busy}>Search people</button></form>{error&&<p role="alert">{error}</p>}{searched&&!people.length&&<p>No matching profiles.</p>}<ul>{people.map(person=><li key={person.id}><Link href={`/people/${person.username}`}>{person.name} <small>@{person.username}</small></Link></li>)}</ul></section>;
}
function PostComposer({onCreated}:{onCreated:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <details className="social-composer"><summary>Create a memory, story or suggestion</summary><form className="social-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;setBusy(true);setError('');try{await communityRequest('/api/community',new FormData(form));form.reset();await onCreated();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
  <label>Post type<select name="kind"><option value="memory">Memory</option><option value="story">Story — 24 hours</option><option value="suggestion">Suggestion</option></select></label>
  <label>Your story<textarea name="text" required maxLength={2000} placeholder="What will you remember about this place?"/></label>
  <label>Who can see it?<select name="visibility" defaultValue="followers"><option value="followers">Approved followers</option><option value="public">Everyone, if my profile is public</option><option value="private">Only me</option></select></label>
  <label>Add a photo (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"/></label><small>JPEG, PNG or WebP, up to 4 MB. Only share photos you have permission to publish. Location metadata is removed.</small>
  {error&&<p role="alert" className="social-error">{error}</p>}<button className="feature-primary" disabled={busy}>{busy?'Saving…':'Publish post'}</button>
 </form></details>;
}
type Comment={id:string;authorId:string;username:string;name:string;text:string;createdAt:string};
function CommunityPost({post,viewer,refresh}:{post:Post;viewer?:string;refresh:()=>Promise<void>}){
 const [comments,setComments]=useState<Comment[]|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 async function loadComments(){try{const result=await communityRequest<{comments:Comment[]}>(`/api/community?view=comments&postId=${post.id}`);setComments(result.comments);}catch(e){setError((e as Error).message);}}
 async function act(body:Record<string,unknown>){setBusy(true);setError('');try{await communityRequest('/api/community',body);await refresh();if(comments)await loadComments();return true;}catch(e){setError((e as Error).message);return false;}finally{setBusy(false);}}
 return <article className="community-post social-post" id={`post-${post.id}`}><header><span className="journal-avatar" aria-hidden="true">{post.name.slice(0,1)}</span><div><Link href={`/people/${post.username}`}><strong>{post.name}</strong></Link><small>@{post.username} · {post.kind}</small></div><small>{post.visibility==='private'?'Only me':post.visibility==='followers'?'Followers':'Public'}</small></header>
  {post.hasPhoto&&<>
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={`/api/community/photo/${post.id}`} alt={`Photo shared by ${post.name}`} className="community-image" width={640} height={480}/>
  </>}
  <p className="social-post-text">{post.text}</p><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</time>
  <div className="community-actions"><button type="button" disabled={!viewer||busy} aria-pressed={post.liked} onClick={()=>void act({action:'like',postId:post.id,liked:!post.liked})}>{post.liked?'♥ Liked':'♡ Like'} · {post.likes}</button><button type="button" disabled={!viewer||busy} onClick={()=>void loadComments()}>Comments · {post.comments}</button><button type="button" onClick={async()=>{const url=`${location.origin}/people/${post.username}?post=${post.id}`;try{await navigator.clipboard.writeText(url);setNotice('Link copied. People still need permission to view private posts.');}catch{setNotice(`Share this link: ${url}`);}}}>Share</button></div>
  {!viewer&&<p className="social-muted"><Link href="/account">Sign in</Link> to like or comment.</p>}
  {notice&&<p role="status" className="social-muted">{notice}</p>}{error&&<p role="alert" className="social-error">{error}</p>}
  {comments&&<section aria-label={`Comments on ${post.name}'s post`}><ul className="social-comments">{comments.map(comment=><li key={comment.id}><Link href={`/people/${comment.username}`}>@{comment.username}</Link><p>{comment.text}</p>{comment.authorId===viewer&&<button disabled={busy} onClick={()=>void act({action:'deleteComment',commentId:comment.id})}>Delete comment</button>}</li>)}</ul><form className="social-comment-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await act({action:'comment',postId:post.id,text:String(new FormData(form).get('text')??'')}))form.reset();}}><label>Add a comment<input name="text" required maxLength={500}/></label><button className="feature-secondary" disabled={busy}>Post comment</button></form></section>}
  {viewer&&<details className="social-post-options"><summary>Post options</summary>{viewer===post.authorId?<button className="feature-secondary" disabled={busy} onClick={()=>void act({action:'deletePost',postId:post.id})}>Delete my post</button>:<form className="social-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;if(await act({action:'report',postId:post.id,reason:String(new FormData(form).get('reason')??'')})){form.reset();setNotice('Report sent to moderators.');}}}><label>Why are you reporting this post?<textarea name="reason" minLength={5} maxLength={500} required/></label><button className="feature-secondary" disabled={busy}>Send report</button></form>}</details>}
 </article>;
}
