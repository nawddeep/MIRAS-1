'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { communityRequest } from '@/lib/community/client';
import type { Member,Post } from '@/lib/community/store';
export function AccountMemories(){
 const [posts,setPosts]=useState<Post[]|null>(null),[username,setUsername]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;async function load(){try{const {user}=await communityRequest<{user:Member|null}>('/api/account');if(!user)throw new Error('Sign in to keep memories in your account.');const result=await communityRequest<{posts:Post[]}>(`/api/community?view=feed&kind=memory&username=${user.username}`);if(active){setUsername(user.username);setPosts(result.posts.filter(post=>post.kind==='memory'));}}catch(e){if(active)setError((e as Error).message);}}void load();return()=>{active=false;};},[]);
 return <section className="social-screen"><h2>Your memories</h2>{error?<p>{error} <Link href="/account">Open account →</Link></p>:posts===null?<p role="status">Loading your memories…</p>:<>{!posts.length&&<p>No memories saved to your account yet.</p>}<div>{posts.map(post=><Link className="account-memory" key={post.id} href={`/people/${username}?post=${post.id}`}>{post.hasPhoto&&<>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={`/api/community/photo/${post.id}`} alt="" width={400} height={240}/></>}<p>{post.text}</p></Link>)}</div><Link className="feature-primary" href={`/people/${username}`}>Share a memory</Link></>}<Link className="feature-inline-link" href="/memories">Create a device-only highlight reel →</Link></section>;
}
