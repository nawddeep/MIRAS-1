import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CommunityFeed } from '@/components/CommunityFeed';
export const metadata:Metadata={title:'MIRAS traveller profile',robots:{index:false,follow:false}};
export default async function PersonPage({params,searchParams}:{params:Promise<{username:string}>;searchParams:Promise<{post?:string}>}){
 const {username}=await params;if(!/^[a-z0-9_]{3,24}$/.test(username))notFound();const {post}=await searchParams;
 return <CommunityFeed key={username} username={username} postId={post}/>;
}
