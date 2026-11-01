import { cookies } from 'next/headers';
import { z } from 'zod';
import { getCommunity } from '@/lib/community/store';
import { apiError,bodyJson,clearSession,currentMember,json,requestKey,requireMember,sameOrigin,SESSION_COOKIE,setSession } from '@/lib/community/http';
export const runtime='nodejs';
const username=z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/);
const password=z.string().min(12).max(128);
const input=z.discriminatedUnion('action',[
 z.object({action:z.literal('register'),username,name:z.string().trim().min(2).max(60),password,role:z.enum(['visitor','artisan','event_manager']).optional()}),
 z.object({action:z.literal('login'),username,password:z.string().min(1).max(128)}),
 z.object({action:z.literal('logout')}),
 z.object({action:z.literal('update'),name:z.string().trim().min(2).max(60),bio:z.string().trim().max(280),privacy:z.enum(['private','public'])}),
 z.object({action:z.literal('recover'),username,recoveryCode:z.string().trim().regex(/^[a-f0-9]{48}$/),password}),
 z.object({action:z.literal('password'),oldPassword:z.string().min(1).max(128),password}),
 z.object({action:z.literal('delete'),password:z.string().min(1).max(128)}),
]);
export async function GET(){try{return json({ok:true,user:await currentMember()??null});}catch(error){return apiError(error);}}
export async function POST(req: Request){try{
 sameOrigin(req);const data=input.parse(await bodyJson(req));const store=getCommunity();
 store.limit(`account-client:${requestKey(req)}`,60);
 if(data.action==='register'){
  store.limit(`register:${requestKey(req)}`,8,3_600_000);
  const {user,token,recoveryCode}=await store.register(data.username,data.name,data.password,data.role ?? 'visitor');await setSession(token);return json({ok:true,user,recoveryCode},201);
 }
 if(data.action==='login'||data.action==='recover'){
  store.limit(`credential:${data.username}`,10);
  const result=data.action==='login'?await store.login(data.username,data.password):await store.reset(data.username,data.recoveryCode,data.password);
  await setSession(result.token);return json({ok:true,user:result.user,...('recoveryCode' in result?{recoveryCode:result.recoveryCode}:{})});
 }
 if(data.action==='logout'){store.logout((await cookies()).get(SESSION_COOKIE)?.value);await clearSession();return json({ok:true});}
 const user=await requireMember();
 if(data.action==='update')return json({ok:true,user:store.update(user.id,data)});
 store.limit(`password:${user.id}`,5);
 if(data.action==='password'){await setSession(await store.changePassword(user.id,data.oldPassword,data.password));return json({ok:true});}
 await store.removeAccount(user.id,data.password);await clearSession();return json({ok:true});
 }catch(error){return apiError(error);}}
