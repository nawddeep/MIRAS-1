import { journeyBadges } from '@/lib/community/badges';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { MOD_COOKIE,isModerator } from '@/lib/admin-auth';
import { CommunityError,getCommunity } from '@/lib/community/store';
import { apiError,bodyJson,currentMember,json,limitedBody,requireMember,sameOrigin } from '@/lib/community/http';
import { normalisePhoto } from '@/lib/community/images';
import { getVisiblePlaces } from '@/lib/services/content';
import { getRepos } from '@/lib/repos';
export const runtime='nodejs';
const id=z.string().uuid();
const username=z.string().regex(/^[a-z0-9_]{3,24}$/);
const postSchema=z.object({kind:z.enum(['memory','story','suggestion']),text:z.string().trim().min(1).max(2000),visibility:z.enum(['public','followers','private'])});
const collectionSchema=z.object({places:z.array(z.string().max(100)).max(500),stories:z.array(z.string().max(150)).max(1000),plan:z.object({placeIds:z.array(z.string().max(100)).max(20),startTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),dayHours:z.number().int().min(2).max(12),mode:z.enum(['walk','drive'])})});
const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('collection'),data:collectionSchema}),
 z.object({action:z.literal('featureBadges'),badgeIds:z.array(z.string().max(100)).max(3)}),
 z.object({action:z.literal('follow'),username}),z.object({action:z.literal('unfollow'),username}),
 z.object({action:z.literal('request'),follower:id,approve:z.boolean()}),z.object({action:z.literal('removeFollower'),follower:id}),
 z.object({action:z.literal('block'),username,blocked:z.boolean()}),
 z.object({action:z.literal('like'),postId:id,liked:z.boolean()}),
 z.object({action:z.literal('comment'),postId:id,text:z.string().trim().min(1).max(500)}),
 z.object({action:z.literal('deleteComment'),commentId:id}),z.object({action:z.literal('deletePost'),postId:id}),
 z.object({action:z.literal('report'),postId:id,reason:z.string().trim().min(5).max(500)}),
 z.object({action:z.literal('journey'),day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),placeIds:z.array(z.string().max(100)).min(1).max(20),trailId:z.string().max(100).optional(),note:z.string().trim().max(500)}),
 z.object({action:z.literal('deleteJourney'),journeyId:id}),
 z.object({action:z.literal('moderate'),postId:id,hide:z.boolean()}),
]);
export async function GET(req: Request){try{
 const user=await currentMember(),store=getCommunity(),url=new URL(req.url),view=url.searchParams.get('view')??'feed';
 if(view==='feed'){
  const page=z.coerce.number().int().min(0).max(1000).parse(url.searchParams.get('page')??0);
  const who=url.searchParams.get('username')||undefined;if(who)username.parse(who);
  const postId=url.searchParams.get('postId')||'';if(postId)id.parse(postId);const kind=url.searchParams.get('kind')||'';if(kind)z.enum(['memory','story','suggestion']).parse(kind);
  const profile=who?store.profile(user?.id,who):null;const featured=profile?.canRead?journeyBadges(store.journeys(profile.user.id),store.memoryCount(profile.user.id)).filter(badge=>badge.earned&&store.featured(profile.user.id).includes(badge.id)).map(({id,title})=>({id,title})):[];
  return json({ok:true,user:user??null,...store.feed(user?.id,who,page,postId,kind),profile:profile?{...profile,featured}:null});
 }
 if(view==='people')return json({ok:true,people:store.people(user?.id,(url.searchParams.get('q')??'').slice(0,60))});
 if(!user)throw new CommunityError('Please sign in to continue.',401);
 if(view==='collection')return json({ok:true,collection:store.collection(user.id)});
 if(view==='connections')return json({ok:true,requests:store.requests(user.id),followers:store.followers(user.id),blocks:store.blocks(user.id)});
 if(view==='comments')return json({ok:true,comments:store.comments(user.id,id.parse(url.searchParams.get('postId')))});
 if(view==='journeys'){const journeys=store.journeys(user.id);return json({ok:true,journeys,featured:store.featured(user.id),badges:journeyBadges(journeys,store.memoryCount(user.id))});}
 throw new CommunityError('Unknown community view.',404);
 }catch(error){return apiError(error);}}
export async function POST(req: Request){try{
 sameOrigin(req);const user=await requireMember(),store=getCommunity();store.limit(`community:${user.id}`,60,60_000);
 if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
  store.limit(`publish:${user.id}`,10,3_600_000);
  const bytes=await limitedBody(req,5*1024*1024);
  const form=await new Request(req.url,{method:'POST',headers:{'content-type':req.headers.get('content-type')!},body:bytes}).formData();
  const value=postSchema.parse(Object.fromEntries(['kind','text','visibility'].map(key=>[key,form.get(key)])));
  const file=form.get('photo');let image:Buffer|undefined;
  if(file instanceof File && file.size)image=await normalisePhoto(Buffer.from(await file.arrayBuffer()));
  return json({ok:true,id:store.createPost(user.id,value,image)},201);
 }
 const data=actionSchema.parse(await bodyJson(req,256*1024));
 switch(data.action){
  case 'featureBadges':{const earned=new Set(journeyBadges(store.journeys(user.id),store.memoryCount(user.id)).filter(b=>b.earned).map(b=>b.id));if(data.badgeIds.some(id=>!earned.has(id)))throw new CommunityError('Only earned milestones can be featured.');store.feature(user.id,data.badgeIds);break;}
  case 'collection':store.saveCollection(user.id,data.data);break;
  case 'follow':store.follow(user.id,data.username);break;
  case 'unfollow':store.unfollow(user.id,data.username);break;
  case 'request':store.resolveRequest(user.id,data.follower,data.approve);break;
  case 'removeFollower':store.removeFollower(user.id,data.follower);break;
  case 'block':store.block(user.id,data.username,data.blocked);break;
  case 'like':store.like(user.id,data.postId,data.liked);break;
  case 'comment':store.comment(user.id,data.postId,data.text);break;
  case 'deleteComment':store.deleteComment(user.id,data.commentId);break;
  case 'deletePost':store.deletePost(user.id,data.postId);break;
  case 'report':store.report(user.id,data.postId,data.reason);break;
  case 'deleteJourney':store.deleteJourney(user.id,data.journeyId);break;
  case 'journey':{
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   const date=new Date(`${data.day}T00:00:00Z`);
   if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==data.day || data.day>today || data.day<'2000-01-01')throw new CommunityError('Choose a valid date in the past or today.');
   const known=new Set(getVisiblePlaces().map(place=>place.id));
   if(data.placeIds.some(place=>!known.has(place)))throw new CommunityError('Choose places from the MIRAS catalogue.');
   if(data.trailId){const trail=getRepos().trails.get(data.trailId);if(!trail||trail.placeIds.some(place=>!data.placeIds.includes(place)))throw new CommunityError('Include all stops from the selected trail.');}
   store.addJourney(user.id,data);break;
  }
  case 'moderate':if(!isModerator((await cookies()).get(MOD_COOKIE)?.value))throw new CommunityError('Moderator access required.',403);store.moderate(data.postId,data.hide);break;
 }
 return json({ok:true});
 }catch(error){return apiError(error);}}
