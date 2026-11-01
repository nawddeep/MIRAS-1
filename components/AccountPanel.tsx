'use client';
import Link from 'next/link';
import { SpotImage } from './SpotImage';
import imageData from '@/content/spot-images.json';
import { AccountBackup } from './AccountBackup';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Member } from '@/lib/community/store';
import { communityRequest } from '@/lib/community/client';

export function AccountPanel({initialUser}:{initialUser:Member|null}) {
 const [user,setUser]=useState(initialUser),[mode,setMode]=useState('login'),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[code,setCode]=useState('');
 const router=useRouter();
 async function submit(form:HTMLFormElement,action:string){
  setBusy(true);setError('');setMessage('');const fields=Object.fromEntries(new FormData(form));
  try{const result=await communityRequest<{ok:true;user?:Member;recoveryCode?:string}>('/api/account',{...fields,action});if(result.user)setUser(result.user);if(result.recoveryCode)setCode(result.recoveryCode);if(action==='logout'||action==='delete'){setUser(null);setCode('');setMode('login');}setMessage(action==='update'?'Profile saved.':action==='password'?'Password changed. Other sessions have been signed out.':action==='delete'?'Account deleted.':action==='logout'?'Signed out.':'You’re signed in.');form.reset();router.refresh();}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <div className="account-panel social-screen"><header><p className="discovery-eyebrow">YOUR MIRAS</p><h1>{user?'Your account':'A place for your journeys.'}</h1><p>{user?`Signed in as @${user.username}`:'Save memories, follow travellers and keep your profile private.'}</p></header>
  {error&&<p role="alert" className="social-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {code&&<section className="recovery-code" aria-labelledby="recovery-title"><h2 id="recovery-title">Save your recovery code</h2><p>This is shown once. Store it somewhere safe: you’ll need it if you forget your password. Recovery rotates the code and signs out all sessions.</p><code>{code}</code><button className="feature-secondary" onClick={()=>setCode('')}>I have saved my code</button></section>}
  {!user?<><SpotImage photo={imageData.photos['pichhola']} name="Lake Pichola"/><div className="journal-tabs" role="group" aria-label="Account action">{[['login','Sign in'],['register','Create account'],['recover','Recover']].map(([value,label])=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>{setMode(value);setError('');setMessage('');}}>{label}</button>)}</div>
   <form key={mode} onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,mode);}} className="social-form">
    <label>Username<input name="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" autoCapitalize="none" spellCheck={false}/></label><small>3–24 letters, numbers or underscores.</small>
    {mode==='register'&&<label>Your name<input name="name" required minLength={2} maxLength={60} autoComplete="name"/></label>}
    {mode==='register'&&<label>I am joining as<select name="role" defaultValue="visitor"><option value="visitor">A traveller</option><option value="artisan">An artisan (I make and sell crafts)</option><option value="event_manager">An event organiser</option></select></label>}
    {mode==='recover'&&<label>Recovery code<input name="recoveryCode" required pattern="[a-f0-9]{48}" maxLength={48} autoComplete="off" spellCheck={false}/></label>}
    <label>{mode==='recover'?'New password':'Password'}<input name="password" required type="password" minLength={mode==='login'?1:12} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'}/></label>
    {mode!=='login'&&<small>Use a unique password of at least 12 characters. Accounts start private.</small>}
    <button className="feature-primary" disabled={busy}>{busy?'Please wait…':mode==='register'?'Create my account':mode==='recover'?'Recover my account':'Sign in'}</button>
   </form><p className="social-muted">No email address is required. Without your password or recovery code, this account cannot be recovered.</p></>:
   <><nav className="social-account-links"><Link href={`/people/${user.username}`}>My social profile ↗</Link><Link href="/discover/community">Community ↗</Link><Link href="/journeys">Journeys &amp; badges ↗</Link>{user.role==='artisan'&&<Link href="/artisan/dashboard">My artisan workspace ↗</Link>}{user.role==='event_manager'&&<Link href="/event-manager/dashboard">My organiser workspace ↗</Link>}</nav>
    <form className="social-form" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,'update');}}><h2>Profile &amp; privacy</h2><label>Display name<input name="name" defaultValue={user.name} minLength={2} maxLength={60} required/></label><label>About you<textarea name="bio" defaultValue={user.bio} maxLength={280}/></label><label>Profile visibility<select name="privacy" defaultValue={user.privacy}><option value="private">Private — approve followers</option><option value="public">Public — anyone can see public posts</option></select></label><p className="social-muted">Your name, username and bio are discoverable. Private profiles show posts only to approved followers. Switching to public approves pending requests.</p><button className="feature-primary" disabled={busy}>Save profile</button></form>
    <AccountBackup/>
    <Connections/>
    <details className="social-settings"><summary>Change password</summary><form className="social-form" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,'password');}}><label>Current password<input name="oldPassword" required type="password" maxLength={128} autoComplete="current-password"/></label><label>New password<input name="password" required type="password" minLength={12} maxLength={128} autoComplete="new-password"/></label><button className="feature-secondary" disabled={busy}>Change password</button></form></details>
    <button className="feature-secondary" disabled={busy} onClick={()=>void submit(document.createElement('form'),'logout')}>Sign out</button>
    <details className="social-settings"><summary>Delete account</summary><p>This permanently deletes your profile, posts, photos, comments, relationships and recorded journeys from the server. Device-only bookmarks and offline copies stay on this device.</p><form className="social-form" onSubmit={e=>{e.preventDefault();void submit(e.currentTarget,'delete');}}><label>Confirm with your password<input type="password" name="password" required maxLength={128} autoComplete="current-password"/></label><label className="social-check"><input type="checkbox" required/>I understand this permanently deletes my account.</label><button className="feature-secondary" disabled={busy}>Permanently delete my account</button></form></details>
   </>}
 </div>;
}

type ConnectionsData={requests:{id:string;username:string;name:string}[];followers:{id:string;username:string;name:string}[];blocks:{username:string;name:string}[]};
function Connections(){
 const [data,setData]=useState<ConnectionsData|null>(null),[error,setError]=useState('');
 async function load(){try{setData(await communityRequest<ConnectionsData>('/api/community?view=connections'));setError('');}catch(e){setError((e as Error).message);}}
 async function act(value:Record<string,unknown>){try{await communityRequest('/api/community',value);await load();}catch(e){setError((e as Error).message);}}
 return <section className="social-connections"><h2>Followers &amp; requests</h2><button className="feature-secondary" onClick={()=>void load()}>Load connections</button>{error&&<p role="alert">{error}</p>}{data&&<><h3>Follow requests ({data.requests.length})</h3>{data.requests.map(person=><div key={person.id}><Link href={`/people/${person.username}`}>@{person.username}</Link><button onClick={()=>void act({action:'request',follower:person.id,approve:true})}>Approve</button><button onClick={()=>void act({action:'request',follower:person.id,approve:false})}>Decline</button></div>)}<h3>Approved followers ({data.followers.length})</h3>{data.followers.map(person=><div key={person.id}><Link href={`/people/${person.username}`}>@{person.username}</Link><button onClick={()=>void act({action:'removeFollower',follower:person.id})}>Remove follower</button></div>)}<h3>Blocked accounts ({data.blocks.length})</h3>{data.blocks.map(person=><div key={person.username}><span>@{person.username}</span><button onClick={()=>void act({action:'block',username:person.username,blocked:false})}>Unblock</button></div>)}</>}</section>;
}
