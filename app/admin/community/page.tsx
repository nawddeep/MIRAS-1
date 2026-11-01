import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { isModerator,MOD_COOKIE,moderationEnabled } from '@/lib/admin-auth';
import { ModeratorSignIn } from '@/components/Moderation';
import { CommunityModeration } from '@/components/CommunityModeration';
import { getCommunity } from '@/lib/community/store';
export const metadata:Metadata={title:'Community moderation | MIRAS',robots:{index:false,follow:false}};
export default async function CommunityModerationPage(){
 if(!moderationEnabled())return <div className="social-screen"><h1>Community moderation</h1><p>Set ADMIN_PASSCODE on the server to enable the moderator queue.</p></div>;
 if(!isModerator((await cookies()).get(MOD_COOKIE)?.value))return <div className="social-screen"><h1>Community moderation</h1><ModeratorSignIn/></div>;
 return <div className="social-screen"><h1>Reported community posts</h1><CommunityModeration reports={getCommunity().reports()}/></div>;
}
