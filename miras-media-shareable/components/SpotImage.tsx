'use client';
import { useState } from 'react';
import imageData from '@/content/spot-images.json';
export type SpotPhoto={src:string;caption:string;owner:string;sourceUrl:string;license:string;licenseUrl:string;note:string};
export function SpotImage({photo,name,category=false}:{photo:SpotPhoto;name:string;category?:boolean}){
 const [failed,setFailed]=useState(false);
 return <figure className="spot-photo"><div className="spot-photo-frame">{failed?<div className="spot-photo-unavailable" role="img" aria-label={`Image unavailable for ${name}`}>MIRAS<span>{name}</span></div>:<>
 {/* eslint-disable-next-line @next/next/no-img-element */}
 <img src={photo.src} alt={category?`${photo.caption} — category visual, not a photo of ${name}`:photo.caption} width={640} height={400} loading="lazy" decoding="async" onError={()=>setFailed(true)}/></>}{category&&<span className="spot-photo-kind">Category scenery</span>}</div><figcaption>{category?'Scenery for this category; venue photo not yet confirmed.':photo.caption}<details><summary>Photo credit</summary><p>{photo.owner} · {photo.license||'Supplied artwork'}</p>{photo.sourceUrl&&<a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">Original photograph ↗</a>}{photo.licenseUrl&&<a href={photo.licenseUrl} target="_blank" rel="noopener noreferrer">{photo.license} ↗</a>}<p>{photo.note}</p></details></figcaption></figure>;
}
export function imageForSpot(id:string){const key=(imageData.matches as Record<string,string>)[id];return {photo:(imageData.photos as Record<string,SpotPhoto>)[key],category:key?.startsWith('category-')??true};}
