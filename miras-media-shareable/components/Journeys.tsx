'use client';
import Link from 'next/link';
import { useCallback,useEffect,useState } from 'react';
import { communityRequest } from '@/lib/community/client';
import { loadPlan } from '@/lib/client/plan-store';
import type { journeyBadges } from '@/lib/community/badges';
import { BadgeIcon } from './icons';
type Badges=ReturnType<typeof journeyBadges>;
type Journey={id:string;day:string;placeIds:string[];trailId:string|null;note:string};
type JourneyData={journeys:Journey[];badges:Badges;featured:string[]};
export function BadgeGrid({badges,compact=false}:{badges:Badges;compact?:boolean}){return <><p className="social-muted">Milestones use journeys you record yourself. They do not verify your physical location.</p><div className="journal-badges">{(compact?badges.slice(0,3):badges).map(badge=><article key={badge.id}><BadgeIcon/><strong>{badge.title}</strong><small>{!badge.available?'Needs confirmed artisan visits':badge.earned?'Earned':`${badge.progress}/${badge.threshold} · Locked`}</small></article>)}</div></>;}
export function AccountBadges({compact=false}:{compact?:boolean}){
 const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;communityRequest<JourneyData>('/api/community?view=journeys').then(data=>{if(active)setData(data);}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[]);
 return <section><h2 className="t-heading">Your milestones</h2>{data?<BadgeGrid badges={data.badges} compact={compact}/>:error?<p className="social-muted">{error} <Link href="/account">Open account</Link></p>:<p role="status">Loading milestones…</p>}<Link className="feature-inline-link" href="/journeys">Record a journey →</Link></section>;
}
export function Journeys({places,trails,today}:{places:{id:string;slug:string;name:string}[];trails:{id:string;name:string;placeIds:string[]}[];today:string}){
 const [data,setData]=useState<JourneyData|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState<string[]>([]);
 const refresh=useCallback(async()=>{try{setData(await communityRequest<JourneyData>('/api/community?view=journeys'));setError('');}catch(e){setError((e as Error).message);}},[]);
 useEffect(()=>{let active=true;communityRequest<JourneyData>('/api/community?view=journeys').then(data=>{if(active)setData(data);}).catch(e=>{if(active)setError((e as Error).message);});return()=>{active=false;};},[]);
 const names=new Map(places.map(p=>[p.id,p.name]));
 return <div className="social-screen"><header><h1>Your journeys.</h1><p>Remember the places you visited and collect personal milestones.</p></header><Link href="/account" className="feature-inline-link">Account &amp; privacy →</Link>{error&&<p role="alert" className="social-error">{error} <button onClick={()=>void refresh()}>Try again</button></p>}{notice&&<p role="status">{notice}</p>}
  {!data&&!error&&<p role="status">Loading your journeys…</p>}
  {data&&<><BadgeGrid badges={data.badges}/><form className="social-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await communityRequest('/api/community',{action:'featureBadges',badgeIds:new FormData(e.currentTarget).getAll('badgeId')});await refresh();setNotice('Featured milestones saved to your profile.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}><h2>Show milestones on your profile</h2><p className="social-muted">Choose up to three earned milestones. Your profile visibility controls who can see them.</p>{data.badges.filter(b=>b.earned).map(badge=><label className="social-check" key={badge.id}><input key={`${badge.id}-${data.featured.includes(badge.id)}`} type="checkbox" name="badgeId" value={badge.id} defaultChecked={data.featured.includes(badge.id)}/>{badge.title}</label>)}<button className="feature-secondary" disabled={busy}>Save featured milestones</button></form><form className="social-form" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,fields=new FormData(form);setBusy(true);setError('');try{await communityRequest('/api/community',{action:'journey',day:fields.get('day'),placeIds:selected,trailId:fields.get('trailId')||undefined,note:fields.get('note')});setNotice('Journey recorded. Your milestones have been updated.');form.reset();setSelected([]);await refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
   <h2>Record a completed journey</h2><p className="social-muted">One journey per day. Record visits honestly; these records are private to your account.</p>
   <label>Visit date<input name="day" type="date" defaultValue={today} max={today} min="2000-01-01" required/></label>
   <button type="button" className="feature-secondary" onClick={()=>setSelected(loadPlan().placeIds.filter(id=>names.has(id)))}>Use this device’s planned stops</button>
   <fieldset className="journey-place-picker"><legend>Places you visited</legend>{places.map(place=><label className="social-check" key={place.id}><input type="checkbox" checked={selected.includes(place.id)} onChange={()=>setSelected(selected.includes(place.id)?selected.filter(id=>id!==place.id):[...selected,place.id])}/>{place.name}</label>)}</fieldset>
   <label>Completed a walking trail? (optional)<select name="trailId" onChange={e=>{const trail=trails.find(t=>t.id===e.target.value);if(trail)setSelected([...new Set([...selected,...trail.placeIds])]);}}><option value="">No trail selected</option>{trails.map(trail=><option key={trail.id} value={trail.id}>{trail.name}</option>)}</select></label>
   <label>Private note<textarea name="note" maxLength={500}/></label><button className="feature-primary" disabled={busy||!selected.length}>{busy?'Saving…':'Record journey'}</button>
  </form><section><h2>Your recorded journeys</h2>{!data.journeys.length&&<p>No journeys recorded yet. Your first visit can start your collection.</p>}{data.journeys.map(journey=><article key={journey.id} className="journey-record"><h3>{journey.day}</h3><p>{journey.placeIds.map(id=>names.get(id)??id).join(' · ')}</p>{journey.note&&<p>{journey.note}</p>}<button className="feature-secondary" disabled={busy} onClick={async()=>{setBusy(true);try{await communityRequest('/api/community',{action:'deleteJourney',journeyId:journey.id});await refresh();setNotice('Journey removed. Milestones recalculated.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Remove record</button></article>)}</section></>}
 </div>;
}
