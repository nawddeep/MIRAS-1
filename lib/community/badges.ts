import definitions from '@/content/badges.json';
export function journeyBadges(journeys:{trailId:string|null}[],memories:number){
 const values:Record<string,number>={completedTrips:journeys.length,completedTrails:journeys.filter(j=>j.trailId).length,publishedMemories:memories,artisanVisits:0};
 return definitions.map(badge=>({...badge,progress:values[badge.metric]??0,earned:badge.metric!=='artisanVisits'&&(values[badge.metric]??0)>=badge.threshold,available:badge.metric!=='artisanVisits'}));
}
