'use client';

import Link from 'next/link';
import badgeDefinitions from '@/content/badges.json';
import { useState } from 'react';
import { frontendFeatures } from '@/lib/frontend-features';
import { ArrowIcon, BookmarkIcon, ProfileIcon } from './icons';

type Feature = typeof frontendFeatures[number];
export function FeaturePreview({ feature }: { feature: Feature }) {
  const [liked,setLiked] = useState(false);
  const [following,setFollowing] = useState(false);
  const [comments,setComments] = useState<string[]>([]);
  const [comment,setComment] = useState('');
  const [notice,setNotice] = useState('');
  const [privacy,setPrivacy] = useState('Private');
  const [feed,setFeed] = useState('Memories');
  const id = feature.id;
  async function share() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/discover/community`);setNotice('Community preview link copied.'); }
    catch { setNotice('Copy this page’s address from your browser to share the preview.'); }
  }
  return <div className={`feature-preview ${id==='community'?'community-reference':''}`}><Link href="/discover" className="feature-back">← All MIRAS features</Link><header className="feature-page-heading"><span className="feature-status">{feature.status}</span><h1>{id==='community'?<>From the city,<br/>with love.</>:feature.title}</h1><p lang="hi">{feature.hi}</p><p>{feature.description}</p></header>
    {(id==='community'||id==='account') && <p className="feature-disclosure">{id==='community'?'Community preview · Nothing is published.':'Frontend demo · No account is signed in. Changes below reset when you leave; nothing is published.'}</p>}
    {id==='community' && <>
      <div className="feature-action-row"><Link href="/memories" className="feature-primary">Create a memory</Link><Link href="/discover/account" className="feature-secondary">Your profile</Link></div>
      <div className="feature-tabs" role="group" aria-label="Community content">{['Memories','Stories','Suggestions'].map(tab=><button type="button" aria-pressed={feed===tab} key={tab} onClick={()=>setFeed(tab)}>{tab}</button>)}</div>
      <article className="community-post"><header><span className="community-avatar"><ProfileIcon size={24}/></span><div><strong>MIRAS journal</strong><small>Sample post · Udaipur</small></div><button type="button" aria-pressed={following} onClick={()=>setFollowing(!following)}>{following?'Following':'Follow'}</button></header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="community-image" src="/media/pichhola/dawn.webp" alt="Illustrative view of Lake Pichhola" width={720} height={480}/>
        <div className="community-caption"><span className="feature-status">{feed}</span><h2>{feed==='Suggestions'?'Leave time for the lakeside':feed==='Stories'?'A city reflected in water':'Some mornings deserve a slower start.'}</h2><p>{feed==='Suggestions'?'A sample suggestion for your itinerary: explore the lake and read its stories before your next stop.':'An illustrative travel memory. Your own photos and stories will live here once accounts and publishing are connected.'}</p></div>
        <div className="community-actions"><button type="button" aria-pressed={liked} onClick={()=>setLiked(!liked)}>{liked?'♥ Liked · 1':'♡ Like'}</button><a href="#preview-comments">Comments · {comments.length}</a><button type="button" onClick={share}>Share</button></div>
        <form id="preview-comments" onSubmit={e=>{e.preventDefault();if(comment.trim()){setComments([...comments,comment.trim()]);setComment('');setNotice('Demo comment added for this preview only.');}}}><label className="sr-only" htmlFor="demo-comment">Try a comment</label><div className="feature-comment-input"><input id="demo-comment" maxLength={500} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Share a thought…"/><button type="submit" disabled={!comment.trim()}>Post</button></div><small>Preview only; comments are not stored or sent.</small></form><ul className="preview-comments">{comments.map((text,index)=><li key={index}><strong>You · Preview</strong><p>{text}</p></li>)}</ul>
      </article>
    </>}
    {id==='badges' && <><p className="feature-disclosure">Trip verification and profile badges are not connected yet. These are proposed milestones, not earned awards.</p><div className="badge-preview-grid">{badgeDefinitions.map(badge=><article key={badge.id}><BookmarkIcon size={32}/><h2>{badge.title}</h2><p>{badge.description}</p><span className="feature-status">Locked · Preview</span></article>)}</div><div className="feature-action-row"><Link href="/passport" className="feature-primary">Open heritage passport</Link><Link href="/discover/account" className="feature-secondary">Preview profile</Link></div><p className="feature-muted">Your existing passport tracks stories opened on this device, not completed trips.</p></>}
    {id==='account' && <><section className="social-profile-preview"><span className="community-avatar"><ProfileIcon size={40}/></span><h2>Your travel journal</h2><p>Profile preview · Account creation is not connected</p><div className="profile-preview-stats"><span><strong>0</strong>Posts</span><span><strong>0</strong>Followers</span><span><strong>0</strong>Following</span></div><fieldset><legend>Try profile visibility</legend><div className="feature-tabs">{['Private','Public'].map(value=><button type="button" key={value} aria-pressed={privacy===value} onClick={()=>setPrivacy(value)}>{value}</button>)}</div><p>{privacy==='Private'?'Private preview: future posts would be visible to approved followers.':'Public preview: future posts would be visible to everyone.'}</p><small>This switch previews the design; it does not change permissions or upload existing memories.</small></fieldset></section><nav className="profile-tools" aria-label="Your journal"><Link href="/memories"><span><strong>Create a memory</strong><small>Make a reel from your own photos</small></span><ArrowIcon/></Link><Link href="/discover/badges"><span><strong>Featured badges</strong><small>Preview your future trip milestones</small></span><ArrowIcon/></Link><Link href="/profile"><span><strong>Saved collection</strong><small>Places and stories on this device</small></span><ArrowIcon/></Link><Link href="/discover/community"><span><strong>Explore the community</strong><small>Try likes, follows and comments</small></span><ArrowIcon/></Link></nav></>}
    {notice && <p className="feature-disclosure" role="status">{notice}</p>}
  </div>;
}
