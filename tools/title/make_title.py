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
    # a translucent collage: the planet and ship of poster 4 behind, the ships of poster 2 ghosted over the sky,
    # and poster 2's red figure pointing at space in front
    bg=cover(p4,(0,60,550,60+412),(W,H))
    bg=ImageChops.multiply(bg,Image.new('RGB',(W,H),(225,225,245)))
    # ghost: the light shapes of poster 2's star-ships and swooshes, screened over the sky
    gh=p2.crop((20,45,436,330)); gh=gh.resize((int(416*1.45),int(285*1.45)),Image.LANCZOS)
    lum=np.asarray(gh.convert('L')).astype(np.float32)
    keepm=Image.fromarray(np.clip((lum-120)/90,0,1).__mul__(255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2))
    layer=Image.new('RGB',(W,H),(0,0,0)); layer.paste(gh,(int(W*0.30),int(H*0.00)),keepm)
    bg=ImageChops.screen(bg,layer.point(lambda v:int(v*0.95)))
    # a night falls from the left so the figure stands out
    dk=Image.linear_gradient('L').rotate(90).resize((W,H)).transpose(Image.FLIP_LEFT_RIGHT)
    dk=dk.point(lambda v:int(255-max(0,(v-0))*0.0))
    ramp=Image.new('L',(W,H),0); rd_=ImageDraw.Draw(ramp)
    for x in range(W):
        t=max(0.0,1-x/(W*0.62)); rd_.line([(x,0),(x,H)],fill=int(255*(1-0.58*t)))
    bg=ImageChops.multiply(bg,Image.merge('RGB',(ramp,ramp,ramp)))
    # the red figure of poster 2, cut out by colour
    a2=np.asarray(p2).astype(int); R,G,B=a2[...,0],a2[...,1],a2[...,2]
    red=((R>150)&(G<120)&(B<110)&(R-G>70)); red[:150,:]=False
    mk=Image.fromarray((red*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))      # close the dark shading
    mk=mk.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))                                                 # drop specks
    box=(10,150,446,670); fg=p2.crop(box); fm=mk.crop(box)
    sc=H*0.80/(box[3]-box[1]); fw,fh=int((box[2]-box[0])*sc),int((box[3]-box[1])*sc)
    fg=fg.resize((fw,fh),Image.LANCZOS); fm=fm.resize((fw,fh),Image.LANCZOS).filter(ImageFilter.GaussianBlur(1))
    pos=(int(-W*0.03),H-fh-int(H*0.10))
    # an echo in deep blue, offset and see-through, for the collage depth
    echo=Image.new('RGB',(fw,fh),(40,40,150)); em=fm.point(lambda v:int(v*0.45))
    bg.paste(echo,(pos[0]+int(W*0.035),pos[1]-int(H*0.03)),em)
    grown=fm.filter(ImageFilter.MaxFilter(9)); bg.paste(Image.new('RGB',(fw,fh),(0,0,0)),pos,grown)
    bg.paste(fg,pos,fm)
    # the ship of poster 4, lifted off its own clouds and set against the planet
    sh=p4.crop((95,385,385,700)); shh=int(H*0.60); shw=int(sh.width*shh/sh.height)
    sh=sh.resize((shw,shh),Image.LANCZOS)
    sm=Image.new('L',(shw,shh),0); ImageDraw.Draw(sm).ellipse([int(shw*0.36),int(shh*0.02),int(shw*0.88),int(shh*0.98)],fill=255)
    sm=sm.filter(ImageFilter.GaussianBlur(int(shw*0.05)))
    spos=(int(W*0.60)-shw//2,int(H*0.40))
    bg.paste(sh,spos,sm)
    d=ImageDraw.Draw(bg)
    rnd=random.Random(11)
    for _ in range(9):
        x=rnd.randint(int(W*0.50),int(W*0.96)); y=rnd.randint(int(H*0.30),int(H*0.66)); sparkle(d,x,y,rnd.choice([6,9,13]))
    t=text_layer('STRELA-10',int(H*0.17),(255,255,255),shadow=(190,20,20),outline=(0,0,0),off=7,tracking=4)
    bg.paste(t,(W-t.width-int(W*0.035),int(H*0.05)),t)
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
