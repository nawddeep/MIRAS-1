'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { communityRequest } from '@/lib/community/client';
export function CommunityModeration({reports}:{reports:{postId:string;reason:string;text:string;username:string;createdAt:string}[]}){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);const router=useRouter();
 async function review(postId:string,hide:boolean){setBusy(true);try{await communityRequest('/api/community',{action:'moderate',postId,hide});router.refresh();setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="social-screen"><p>Also sign in to a MIRAS account to perform moderation actions. <Link href="/account">Open account →</Link></p>{error&&<p role="alert">{error}</p>}{!reports.length&&<p>No reported posts awaiting review.</p>}{reports.map((report,index)=><article className="journey-record" key={`${report.postId}-${index}`}><h2>@{report.username}</h2><p>{report.text}</p><p><strong>Report:</strong> {report.reason}</p><div className="feature-action-row"><button className="feature-secondary" disabled={busy} onClick={()=>void review(report.postId,true)}>Hide post and photo</button><button className="feature-secondary" disabled={busy} onClick={()=>void review(report.postId,false)}>Dismiss report</button></div></article>)}</section>;
}
