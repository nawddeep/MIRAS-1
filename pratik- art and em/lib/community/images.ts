import sharp from 'sharp';
import { CommunityError } from './store';
export async function normalisePhoto(data: Buffer) {
  if(data.length>4*1024*1024)throw new CommunityError('Choose a photo smaller than 4 MB.',413);
  try {
    const input=sharp(data,{limitInputPixels:24_000_000,animated:false});
    const metadata=await input.metadata();
    if(!['jpeg','png','webp'].includes(metadata.format??'') || (metadata.pages??1)>1)throw new Error('Unsupported image');
    // Re-encoding strips GPS/EXIF and refuses malformed images, SVG and animations.
    return await input.rotate().resize({width:1600,height:1600,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
  }catch{throw new CommunityError('Choose a valid JPEG, PNG or WebP photo.');}
}
