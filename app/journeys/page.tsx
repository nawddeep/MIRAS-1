import type { Metadata } from 'next';
import { Journeys } from '@/components/Journeys';
import { getVisiblePlaces } from '@/lib/services/content';
import { getVisibleTrails } from '@/lib/services/trails';
export const metadata:Metadata={title:'Your journeys & badges | MIRAS',robots:{index:false,follow:false}};
export default function JourneysPage(){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return <Journeys places={getVisiblePlaces().map(({id,slug,name})=>({id,slug,name}))} trails={getVisibleTrails().map(({id,title,placeIds})=>({id,name:title,placeIds}))} today={today}/>;
}
