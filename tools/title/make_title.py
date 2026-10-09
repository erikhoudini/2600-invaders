"""Kit-bashes the four title posters into the two title cards (assets/intro-0.png, intro-1.png).

Run from the repo root:  python3 tools/title/make_title.py
The composite is built at 4x, shrunk to 256x192, then palettized to the game palette with ordered dither.
"""
import sys, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
import os
ROOT=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IM=ROOT+'/art/source/title/'
p1,p2,p3,p4=[Image.open(IM+f'poster{i}.webp').convert('RGB') for i in (1,2,3,4)]
S=4; W,H=256*S,192*S
def cover(im,box,size):
    return im.crop(box).resize(size,Image.LANCZOS)
def key_alpha(im, white=True, black=True):
    a=np.asarray(im,dtype=np.float32)
    mn=a.min(axis=2); mx=a.max(axis=2)
    al=np.ones(mn.shape,dtype=np.float32)
    if white: al=np.minimum(al,np.clip((245-mn)/40.0,0,1))          # near white -> transparent
    if black: al=np.minimum(al,np.clip((mx-70)/60.0,0,1))           # near black -> transparent
    return Image.fromarray((al*255).astype(np.uint8))
def screen(base,over,pos):
    layer=Image.new('RGB',base.size,(0,0,0)); layer.paste(over,pos)
    return ImageChops.screen(base,layer)
def sparkle(d,x,y,r,col=(255,255,255)):
    d.polygon([(x,y-r),(x+r*0.18,y-r*0.18),(x+r,y),(x+r*0.18,y+r*0.18),(x,y+r),(x-r*0.18,y+r*0.18),(x-r,y),(x-r*0.18,y-r*0.18)],fill=col)
def font(sz,bold=True,obl=True):
    f='/usr/share/fonts/truetype/freefont/FreeSans%s.ttf'%('BoldOblique' if bold and obl else 'Bold' if bold else 'Oblique' if obl else '')
    return ImageFont.truetype(f,sz)
def text_layer(txt,sz,fill,shadow=None,outline=None,off=6,skew=0.0,tracking=0):
    f=font(sz); tmp=Image.new('RGBA',(W,sz*2),(0,0,0,0)); d=ImageDraw.Draw(tmp)
    x=20
    for ch in txt:
        if outline: 
            for dx in range(-4,5,2):
                for dy in range(-4,5,2): d.text((x+dx+off*(1 if shadow else 0),sz*0.25+dy+off*(1 if shadow else 0)),ch,font=f,fill=outline)
        if shadow: d.text((x+off,sz*0.25+off),ch,font=f,fill=shadow)
        x+=d.textlength(ch,font=f)+tracking
    x=20
    for ch in txt:
        if outline:
            for dx in range(-4,5,2):
                for dy in range(-4,5,2): d.text((x+dx,sz*0.25+dy),ch,font=f,fill=outline)
        d.text((x,sz*0.25),ch,font=f,fill=fill); x+=d.textlength(ch,font=f)+tracking
    bb=tmp.getbbox(); return tmp.crop(bb)

def top():
    bg=cover(p4,(0,40,440,40+330),(W,H))
    # a little night over the painting so the title and the red rocket carry
    bg=ImageChops.multiply(bg,Image.new('RGB',(W,H),(215,215,240)))
    # flame streaks from poster 4 stay; star-ships from poster 2 as a faint arc high on the left
    sw=p2.crop((70,75,420,300)); sw=sw.resize((int(350*1.15),int(225*1.15)),Image.LANCZOS)
    fm=Image.new('L',sw.size,0); ImageDraw.Draw(fm).ellipse([int(sw.width*0.08),int(sw.height*0.08),int(sw.width*0.92),int(sw.height*0.92)],fill=255)
    fm=fm.filter(ImageFilter.GaussianBlur(40))
    layer=Image.new('RGB',(W,H),(0,0,0)); layer.paste(sw,(int(W*0.0),int(H*0.28)),fm)
    layer=ImageChops.multiply(layer,Image.new('RGB',(W,H),(150,150,185)))
    bg=ImageChops.screen(bg,layer.point(lambda v:int(v*0.55)))
    # Soyuz, hammer and sickle, and the red land from poster 3
    mon=p3.crop((0,0,1075,1240)); al=key_alpha(mon)
    m=np.asarray(mon).astype(np.float32); R,G,B=m[...,0],m[...,1],m[...,2]
    # the emblem is brown: make it gold so it holds against the sky
    xs=np.arange(m.shape[1])[None,:]
    outside=(xs<466)|(xs>616)
    brown=((R>70)&(R<195)&(G<R*0.56)&(B<R*0.46))|(outside&(R>70)&(R<225)&(G<R*0.42)&(B<R*0.42)&(np.arange(m.shape[0])[:,None]>560))
    lum=(R*0.6+G*0.3+B*0.1)/110.0
    for c,v in enumerate((246,206,70)): m[...,c]=np.where(brown,np.clip(v*np.clip(lum,0.75,1.15),0,255),m[...,c])
    # clear the lettering on the rocket by copying the plain body from its left edge
    x0,x1=486,592
    txt=(R>215)&(G>105)&(G<205)&(B<130)
    for y in range(380,800):
        row=txt[y,x0:x1]
        if row.any(): m[y,x0:x1][row]=m[y,x0-8]
    mon=Image.fromarray(np.clip(m,0,255).astype(np.uint8))
    dm=ImageDraw.Draw(mon); cx,cy,r=539,560,46
    pts=[(cx+(r if i%2==0 else r*0.42)*math.sin(i*math.pi/5),cy-(r if i%2==0 else r*0.42)*math.cos(i*math.pi/5)) for i in range(10)]
    dm.polygon(pts,fill=(250,226,90))
    sc=H*0.86/1240; mw,mh=int(1075*sc),int(1240*sc)
    mon=mon.resize((mw,mh),Image.LANCZOS); al=al.resize((mw,mh),Image.LANCZOS)
    px=int(W*0.64)-mw//2; py=H-mh-int(H*0.12)
    ground=Image.new('RGB',(W,int(H*0.16)),(226,64,28)); gm=Image.linear_gradient('L').resize((W,ground.height)).transpose(Image.FLIP_TOP_BOTTOM)
    bg.paste(ground,(0,H-ground.height),gm.point(lambda v:min(255,int(v*1.6))))
    bg.paste(mon,(px,py),al)
    d=ImageDraw.Draw(bg)
    rnd=random.Random(7)
    for _ in range(9):
        x=rnd.randint(int(W*0.02),int(W*0.5)); y=rnd.randint(int(H*0.42),int(H*0.78)); sparkle(d,x,y,rnd.choice([6,8,12]))
    # title, stacked on the left
    t1=text_layer('STRELA-',int(H*0.165),(255,255,255),shadow=(190,20,20),outline=(0,0,0),off=7,tracking=4)
    t2=text_layer('10',int(H*0.34),(250,224,80),shadow=(190,20,20),outline=(0,0,0),off=9,tracking=2)
    bg.paste(t1,(int(W*0.04),int(H*0.06)),t1)
    bg.paste(t2,(int(W*0.04),int(H*0.06)+t1.height+int(H*0.0)),t2)
    # ribbon
    rb=Image.new('RGBA',(int(W*0.95),int(H*0.085)),(0,0,0,0)); rd=ImageDraw.Draw(rb)
    rd.polygon([(0,0),(rb.width-30,0),(rb.width,rb.height),(30,rb.height)],fill=(205,24,30,255))
    rd.polygon([(0,0),(rb.width-30,0),(rb.width-26,8),(4,8)],fill=(240,220,90,255))
    s=text_layer('SOVIET ORBITAL STRIKE FORCE',int(H*0.062),(255,255,255),tracking=3)
    rb.paste(s,((rb.width-s.width)//2,(rb.height-s.height)//2+4),s)
    bg.paste(rb,(int(W*0.025),int(H*0.875)),rb)
    return bg

def bottom():
    bg=cover(p1,(0,40,683,40+512),(W,H))
    fl=cover(p4,(180,0,550,277),(int(W*0.55),int(H*0.55))).point(lambda v:int(v*0.8))
    lay=Image.new('RGB',(W,H),(0,0,0)); lay.paste(fl,(int(W*0.0),int(H*0.0)))
    bg=ImageChops.screen(bg,lay.point(lambda v:int(v*0.0)))
    d=ImageDraw.Draw(bg)
    # bar for the PRESS START text
    bar=int(H*0.21)
    bar_img=Image.new('RGB',(W,bar),(120,10,18)); bg.paste(bar_img,(0,H-bar))
    d.rectangle([0,H-bar,W,H-bar+6],fill=(240,220,90))
    d.rectangle([0,H-bar+10,W,H-bar+12],fill=(205,24,30))
    return bg



sys.path.insert(0,os.path.join(ROOT,'tools'))
import make_gallery as mg
pal=mg.load_palette(); pal_lab=mg.srgb_to_lab(pal)
HERE=ROOT+'/assets/'
K=16
mg.SPREAD=34
for build,out in ((top,'intro-0'),(bottom,'intro-1')):
    im=build().convert('RGB')
    small=im.resize((256,192),Image.LANCZOS)
    arr=np.asarray(small,dtype=np.float64)
    counts=np.bincount(mg.nearest(arr,pal_lab).ravel(),minlength=len(pal))
    keep=np.argsort(counts)[::-1][:K]
    sub,sub_lab=pal[keep],pal_lab[keep]
    idx=keep[mg.nearest(arr,sub_lab)]
    sz=mg.save_indexed(idx,pal,HERE+out+'.png')
    print(out,sz,'bytes', [int(k) for k in keep[:K]])
