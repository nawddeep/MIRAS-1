import { cookies } from 'next/headers';
import { CommunityError, getCommunity } from './store';

export const SESSION_COOKIE = process.env.NODE_ENV==='production'?'__Host-miras_session':'miras_session';
export const privateHeaders = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' };
export const json = (data: unknown, status = 200) => Response.json(data, {status,headers:privateHeaders});
export async function currentMember() { return getCommunity().current((await cookies()).get(SESSION_COOKIE)?.value); }
export async function requireMember() { const user=await currentMember();if(!user)throw new CommunityError('Please sign in to continue.',401);return user; }
export async function setSession(token: string) {
  (await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:30*86400});
}
export async function clearSession() { (await cookies()).set(SESSION_COOKIE,'',{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0}); }
export function sameOrigin(req: Request) {
  const origin=req.headers.get('origin');
  const expected=process.env.MIRAS_APP_ORIGIN || new URL(req.url).origin;
  if(!origin || origin!==expected || req.headers.get('sec-fetch-site')==='cross-site')throw new CommunityError('Please submit this action from MIRAS.',403);
}
export function requestKey(req: Request) {
  return process.env.MIRAS_TRUST_PROXY==='true' ? req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local' : 'local';
}
export async function limitedBody(req: Request, max=16_384) {
  if(Number(req.headers.get('content-length'))>max)throw new CommunityError('The upload is too large.',413);
  const reader=req.body?.getReader();if(!reader)throw new CommunityError('No data received.');
  const chunks:Uint8Array[]=[];let size=0;
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new CommunityError('The upload is too large.',413);}chunks.push(value);} }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export async function bodyJson(req: Request,max=16_384) {
  try{return JSON.parse((await limitedBody(req,max)).toString('utf8'));}
  catch(error){if(error instanceof CommunityError)throw error;throw new CommunityError('Please submit valid form data.');}
}
export function apiError(error: unknown) {
  if(error instanceof CommunityError)return json({ok:false,error:error.message},error.status);
  if(error && typeof error==='object' && 'issues' in error)return json({ok:false,error:'Check the form fields and try again.'},400);
  console.error('Community request failed:',error instanceof Error ? error.name : 'unknown');
  return json({ok:false,error:'Something went wrong. Please try again.'},500);
}
