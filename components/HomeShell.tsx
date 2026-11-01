"use client";
import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Lang } from '@/lib/i18n';
import type { TimeMode } from '@/lib/time-of-day';
import { CraftIcon, GridIcon, MoreIcon, PlacesIcon, ProfileIcon, RouteIcon, SearchIcon } from './icons';
type Copy = Record<TimeMode,{greetingHi:string;greetingEn:string;headline:string;headlineHi:string}>;
export function HomeShell({top,children}:{copy:Copy;demoMode:boolean;lang:Lang;top:ReactNode;children?:ReactNode}){
 return <div data-time="day" data-testid="home-shell" className="hours-home mobile-concept-home"><header className="concept-home-top"><Link href="/profile" aria-label="Your profile"><ProfileIcon/></Link><span>MIRAS</span><Link href="/discover" aria-label="All features"><GridIcon/></Link></header><section className="concept-home-title"><h1>A city worth<br/>slowing down for.</h1><p>UDAIPUR, RAJASTHAN</p></section><div className="hours-home-content"><form action="/search" role="search" className="hours-search"><SearchIcon size={20}/><label htmlFor="home-q" className="sr-only">Search places, stories and crafts</label><input id="home-q" name="q" type="search" placeholder="Find places, stories, local crafts"/></form><nav className="concept-categories" aria-label="Categories">{[{href:'/places',name:'Places',icon:PlacesIcon},{href:'/trails',name:'Trails',icon:RouteIcon},{href:'/places/shilpgram',name:'Crafts',icon:CraftIcon},{href:'/discover',name:'More',icon:MoreIcon}].map(({href,name,icon:Icon})=><Link href={href} key={name}><Icon size={23}/><span>{name}</span></Link>)}</nav>{children}<details className="hours-settings"><summary>Language &amp; preferences</summary>{top}</details></div></div>;
}
