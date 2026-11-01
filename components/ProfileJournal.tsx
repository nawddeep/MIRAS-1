'use client';
import { useState, type ComponentProps } from 'react';
import { SavedItems } from './SavedItems';
import { AccountBadges } from './Journeys';
import { AccountMemories } from './AccountMemories';
export function ProfileJournal({items}:ComponentProps<typeof SavedItems>){
 const [tab,setTab]=useState('Saved');
 return <><div className="journal-tabs" role="group" aria-label="Your journal sections">{['Saved','Memories','Badges'].map(name=><button type="button" aria-pressed={tab===name} onClick={()=>setTab(name)} key={name}>{name}</button>)}</div>{tab==='Saved'?<SavedItems items={items}/>:tab==='Memories'?<AccountMemories/>:<AccountBadges/>}{tab==='Saved'&&<AccountBadges compact/>}</>;
}
