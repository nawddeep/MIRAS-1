import type { Metadata } from 'next';
import { AccountPanel } from '@/components/AccountPanel';
import { currentMember } from '@/lib/community/http';
export const metadata:Metadata={title:'Your MIRAS account',robots:{index:false,follow:false}};
export default async function AccountPage(){return <AccountPanel initialUser={await currentMember()??null}/>;}
