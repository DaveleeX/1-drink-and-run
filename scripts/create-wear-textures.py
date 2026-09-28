from PIL import Image,ImageFilter,ImageDraw,ImageFont
import numpy as np
from pathlib import Path
out=Path(__file__).resolve().parent.parent/'dist/assets';rng=np.random.default_rng(1701);n=256
coarse=Image.fromarray(rng.integers(0,256,(24,24),dtype=np.uint8)).resize((n,n),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(3));a=np.asarray(coarse)/255
fine=rng.random((n,n));height=np.clip(a*.75+fine*.25,0,1)
for typ,base,metal in [('metal',(151,113,62),.9),('paper',(205,190,153),0),('wood',(97,62,31),0),('shell',(76,34,13),0),('ceramic',(46,51,43),.05)]:
 h=height.copy();h[:,::31]*=.65;Image.fromarray(np.uint8(h*255)).save(out/f'wear-{typ}-height.png')
 rgb=np.clip(np.array(base)[None,None,:]*(.6+.6*a[:,:,None]) + (fine[:,:,None]-.5)*14,0,255)
 Image.fromarray(np.uint8(rgb)).save(out/f'wear-{typ}-color.jpg',quality=90)
 rough=np.clip(.25+a*.6,0,1);packed=np.stack([np.ones_like(a),rough,np.clip(metal-a*.2,0,1)],axis=-1)
 Image.fromarray(np.uint8(packed*255)).save(out/f'wear-{typ}-orm.jpg',quality=90)
 dy,dx=np.gradient(h);normal=np.stack([-dx*2,-dy*2,np.ones_like(a)],axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
 Image.fromarray(np.uint8((normal*.5+.5)*255)).save(out/f'wear-{typ}-normal.png')
font='/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
for kind in ['receipt','note']:
 im=Image.new('RGB',(512,768),(211,199,170));d=ImageDraw.Draw(im)
 for i in range(8000):
  x,y=rng.integers(0,512),rng.integers(0,768);d.point((int(x),int(y)),fill=(170,157,130))
 lines=['NOCTURNE','MIDNIGHT BAR','','TABLE 07 / 03:58 AM','--------------------','WHISKY       18.00','CIGAR        24.00','WHISKY       18.00','--------------------','TOTAL        60.00','','UNPAID','','Guest: 2','One never arrived.'] if kind=='receipt' else ['04:00.','','Come alone.','','Leave the ring.','','Do not call me.','','— M']
 for i,line in enumerate(lines):d.text((35,45+i*42),line,font=ImageFont.truetype(font,24 if kind=='receipt' else 29),fill=(54,47,39))
 d.ellipse((340,590,540,810),outline=(139,105,65),width=9);d.line((8,380,502,410),fill=(160,148,124),width=3)
 im.save(out/f'{kind}-print.jpg',quality=93)
