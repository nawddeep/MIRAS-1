import { currentMember,apiError,privateHeaders } from '@/lib/community/http';
import { getCommunity } from '@/lib/community/store';
export const runtime='nodejs';
export async function GET(_req: Request,{params}:{params:Promise<{id:string}>}){
 try{const {id}=await params;const user=await currentMember();const image=getCommunity().photo(user?.id,id);return new Response(new Uint8Array(image),{headers:{...privateHeaders,'content-type':'image/webp','cross-origin-resource-policy':'same-origin'}});}
 catch(error){return apiError(error);}
}
