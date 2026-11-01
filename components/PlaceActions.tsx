'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadPlan, savePlan } from '@/lib/client/plan-store';
import { BookmarkPlace } from './BookmarkPlace';
import { PlacesIcon } from './icons';

export function PlaceActions({ id, name }: { id: string; name: string }) {
  const [inPlan,setInPlan]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    const sync=()=>setInPlan(loadPlan().placeIds.includes(id));
    sync();window.addEventListener('storage',sync);
    return ()=>window.removeEventListener('storage',sync);
  },[id]);
  function add(){
    const plan=loadPlan();
    if(savePlan({...plan,placeIds:[...new Set([...plan.placeIds,id])]})){
      setInPlan(true);setNotice(`${name} added to your plan. Confirm visit hours before scheduling.`);
    }else setNotice('Your browser could not save the plan. Check device storage access and try again.');
  }
  return <div className="place-actions-wrap"><nav className="place-actions" aria-label="Place actions">{inPlan?<Link className="place-primary" href="/plan">View my day →</Link>:<button className="place-primary" type="button" onClick={add}>Add to my day</button>}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, Udaipur, Rajasthan`)}`} target="_blank" rel="noopener noreferrer"><PlacesIcon size={19}/>Directions ↗</a><BookmarkPlace slug={id} appearance="action"/></nav>{notice && <p className="place-action-feedback" role="status">{notice}</p>}</div>;
}
