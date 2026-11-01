import sharp from 'sharp';
import fs from 'node:fs/promises';
const source = process.argv[2];
if (!source) throw new Error('Pass the supplied 1448×1086 background sheet path');
const names = ['splash','dawn','golden','palace','palace-wide','night','story','camera','temple','artisan','moonlight','garden'];
const {width,height} = await sharp(source).metadata();
await fs.mkdir('public/media/pichhola',{recursive:true});
for (let i=0;i<names.length;i++) {
 const x=Math.round((i%4)*width/4), y=Math.round(Math.floor(i/4)*height/3);
 const right=Math.round((i%4+1)*width/4), bottom=Math.round((Math.floor(i/4)+1)*height/3);
 await sharp(source).extract({left:x+2,top:y+2,width:right-x-4,height:bottom-y-4}).webp({quality:90}).toFile(`public/media/pichhola/${names[i]}.webp`);
}
await sharp('public/media/pichhola/artisan.webp').extract({left:80,top:190,width:260,height:165}).webp({quality:90}).toFile('public/media/pichhola/artwork.webp');
await sharp('public/media/pichhola/artisan.webp').extract({left:140,top:250,width:160,height:100}).webp({quality:90}).toFile('public/media/pichhola/artwork-detail.webp');
console.log('Extracted 12 backgrounds and 2 artwork details, with grid seams removed.');
