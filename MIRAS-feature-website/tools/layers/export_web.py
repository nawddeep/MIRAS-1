# Copies masters to /art and writes WebP (4K + 2K) + layers.json to /public/hero.
# Run from tools/layers after the pipeline.
import json, shutil, glob, os
from PIL import Image
R='../..'
meta=json.load(open('layers/layers.json'))
os.makedirs(f'{R}/art/layers',exist_ok=True); os.makedirs(f'{R}/art/masks',exist_ok=True); os.makedirs(f'{R}/public/hero/layers',exist_ok=True)
for f in glob.glob('layers/*.png'): shutil.copy(f,f'{R}/art/layers/')
for f in glob.glob('masks/*.png'): shutil.copy(f,f'{R}/art/masks/')
shutil.copy('plate_final.png',f'{R}/art/plate.png'); shutil.copy('motion_map.png',f'{R}/art/motion_map.png')
shutil.copy('motion_map.png',f'{R}/public/hero/motion_map.png')
p=Image.open('plate_final.png')
p.save(f'{R}/public/hero/plate@4k.webp',quality=88,method=6)
p.resize((1920,1080),Image.LANCZOS).save(f'{R}/public/hero/plate@2k.webp',quality=88,method=6)
Image.open(f'{R}/udaipur_4k_no_title.png').resize((1920,1080),Image.LANCZOS).save(f'{R}/public/hero/original@2k.webp',quality=88,method=6)
labels={'walkers_pair':'Two friends crossing','walker_saree':'Woman in saree','walker_man':'Man with backpack','cyclist':'Cyclist',
 'rickshaw_near':'Auto-rickshaw (near)','rickshaw_far':'Auto-rickshaw (far)','scooter_far':'Scooter (far)','palm':'Palm tree'}
order={'sky':0,'trees':1,'boats':5}
for L in meta['layers']:
    im=Image.open(f"layers/{L['id']}.png")
    im.save(f"{R}/public/hero/layers/{L['id']}@4k.webp",quality=90,method=6)
    im.resize((max(1,round(im.width/2)),max(1,round(im.height/2))),Image.LANCZOS).save(f"{R}/public/hero/layers/{L['id']}@2k.webp",quality=90,method=6)
    L['z']=order.get(L['group'],2)*10000+L['y']+L['h']
    L['label']=labels.get(L['id'],L['id'].replace('_',' ').capitalize())
meta['layers'].sort(key=lambda L:L['z'])
meta['plate']='plate'; meta['motionMap']={'file':'motion_map.png','R':'foliage sway weight','G':'per-tree phase','B':'water ripple mask'}
json.dump(meta,open(f'{R}/public/hero/layers.json','w'),indent=1)
