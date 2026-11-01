import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const read=path=>JSON.parse(readFileSync(path,'utf8'));
const spots=read('content/research/udaipur-spots.json'),media=read('content/media.json');
const photos={},matches={};
function photo(id,src,caption){const rights=media.find(m=>m.path===src);if(!rights||!existsSync(`public${src}`))throw new Error(`Unregistered photo ${src}`);photos[id]={src,caption,owner:rights.owner,sourceUrl:rights.sourceUrl??'',license:rights.license??'',licenseUrl:rights.licenseUrl??'',note:rights.licenceNote};return id;}
const old={
 'ahar-cenotaphs':['ahar-cenotaphs','Ahar Cenotaphs'],
 'lok-kala-mandal':['bharatiya-lok-kala-mandal-museum','Bharatiya Lok Kala Mandal collection'],
 'shilpgram':['shilpgram','Shilpgram'],
 'jagdish-temple':['jagdish-temple','Jagdish Temple'],
 'city-palace':['udaipur-city-palace','City Palace, Udaipur'],
 'moti-magri':['moti-magri','View from Moti Magri'],
 'doodh-talai':['doodh-talai','Doodh Talai'],
 'saheliyon-ki-bari':['saheliyon-ki-badi','Saheliyon ki Bari'],
 'pichhola':['pichola-lake','Lake Pichola'],
 'fateh-sagar':['fateh-sagar-lake','Fateh Sagar Lake'],
 'udai-sagar':['udai-sagar-lake','Udai Sagar Lake'],
 'bagore-ki-haveli':['bagore-ki-haveli','Bagore Ki Haveli'],
};
for(const [place,[spot,caption]] of Object.entries(old)){const src=place==='badi-lake'?'/media/places/badi-lake-2.webp':`/media/places/${place}-1.webp`;matches[spot]=photo(place,src,caption);}
matches['puppet-show-bharatiya-lok-kala-mandal']='lok-kala-mandal';
const newAliases={
 'ambrai-ghat':['ambrai-ghat'], 'gangaur-ghat':['gangaur-ghat'],
 'neemach-mata':['neemach-mata-temple'], 'gulab-bagh':['gulab-bagh-and-zoo'],
 'eklingji':['eklingji'], 'sas-bahu':['sas-bahu-temple','sahasra-bahu-temples'],
 'kumbhalgarh':['kumbhalgarh-fort-wildlife-sanctuary'], 'jaisamand':['jaisamand-lake'],
};
const captions={'neemach-mata':'View from Neemach Mata Temple','gulab-bagh':'Gulab Bagh garden','kumbhalgarh':'Kumbhalgarh Fort — not the entire wildlife sanctuary','sas-bahu':'Sahasra Bahu temples, Nagda'};
if(existsSync('docs/spot-images/imported.json'))for(const item of read('docs/spot-images/imported.json')){photo(item.id,item.localPath,captions[item.id]??item.title.replace(/^File:/,'').replace(/\.[^.]+$/,''));for(const alias of newAliases[item.id]??[])matches[alias]=item.id;}
// Generic scenery is explicitly labelled as such; it never claims to depict an unverified venue.
photo('category-lake','/media/places/fateh-sagar-2.webp','Udaipur lake scenery');
photo('category-nature','/media/places/moti-magri-2.webp','Udaipur landscape');
photo('category-garden','/media/places/saheliyon-ki-bari-2.webp','Udaipur garden scenery');
photo('category-heritage','/media/places/city-palace-1.webp','Udaipur heritage architecture');
photo('category-temple','/media/places/jagdish-temple-2.webp','Udaipur temple architecture');
photo('category-craft','/media/places/shilpgram-2.webp','Rural arts and crafts setting in Udaipur');
photo('category-waterfront','/media/places/pichhola-2.webp','Udaipur waterfront scenery');
const categories={'Lakes, Dams & Ghats':'category-lake','Scenic Viewpoint & Trek':'category-nature','Palaces, Forts & Architecture':'category-heritage','Cultural & Folk Heritage':'category-craft','Spiritual & Heritage Shrines':'category-temple','Waterfall & Nature':'category-lake','Wildlife & Nature Parks':'category-garden','Offbeat Tourist Spot':'category-waterfront'};
const excluded=['ad','virendra-singh-shaktawat','arjun-singh-rathore','instagram','udaipur-hidden-waterfall','stepout','thejamminghousecafe','what-is-the-best-time-for-offbeat-udaipur','safety-access-and-etiquette-for-udaipur-s-less-touristy-places','is-it-better-to-hire-a-local-driver-for-offbeat-udaipur','udaipur-mount-abu-tour-with-nakki-lake-and-dilwara-temples','related-topics','more-about-udaipur','udaipur-trip-cost-2026-budget-for-2-3-4-and-5-days','planning-a-trip-around-udaipur','company','policies','important-links','connect-with-us','legal','rajasthan-5-nights-6-days-jaipur-jodhpur-udaipur','royal-rajasthan-tour-5n-6d-udaipur-jodhpur-jaisalmer','royal-rajasthan-escape'];
for(const spot of spots){if(excluded.includes(spot.id)||matches[spot.id])continue;matches[spot.id]=/hotel|resort|haveli|manor|palace|homestay|guest house|zostel/i.test(spot.name)?'category-heritage':/restaurant|cafe|cafeteria|restro|dining/i.test(spot.name)?'category-waterfront':categories[spot.category]??'category-waterfront';}
writeFileSync('content/spot-images.json',JSON.stringify({photos,matches,excluded},null,2)+'\n');
const exact=spots.filter(s=>!excluded.includes(s.id)&&!matches[s.id].startsWith('category-')).length;
const report={imported:spots.length,visible:spots.length-excluded.length,matchedPlacePhotos:exact,categoryVisuals:spots.length-excluded.length-exact,excludedScrapeNoise:excluded,localPhotoAssets:Object.keys(photos).length};
writeFileSync('docs/spot-images/coverage.json',JSON.stringify(report,null,2)+'\n');console.log(report);
