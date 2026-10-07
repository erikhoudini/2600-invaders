'use strict';
// Rendering: gameplay, top and bottom screens, HUD
// =====================================================================
//  RENDER
// =====================================================================
function render(){
  ctx.save();
  if(shake>0 && opts.shake){const m=shake*3;ctx.translate(Math.round(rnd(-m,m)),Math.round(rnd(-m,m)));}
  const t=performance.now()/1000;
  uiFrame(t);

  if (menuState === 'game'){
    drawGameplay(t);
    if (paused) drawPauseOverlay(t); else drawPauseButton(t);
  } else if (menuState === 'press' || menuState === 'briefing'){
    if (menuState === 'press') drawPressTop(t); else drawBriefTop(t);
    ctx.fillStyle = P.blk; ctx.fillRect(0, SH, W, GAP);
    ctx.save(); ctx.translate(0, BOT);
    if (menuState === 'press') drawPressBottom(t); else drawBriefBottom(t);
    ctx.restore();
  } else if (menuState === 'gallery'){
    drawGallery(t);
  } else {
    const env = menuEnv();
    drawMenuBackdrop(t, env);
    drawMenuTop(t, env);
    if (menuState === 'loadout') drawLoadoutPreview(t, env);
    // All interactive menu content lives on the bottom screen
    ctx.save();
    const tr = uiTransition(menuState);
    ctx.translate(tr.dx, BOT);
    ctx.globalAlpha = tr.a;
    if (menuState === 'title') drawTitleMenu(t);
    else if (menuState === 'deploy') drawDeployScreen(t);
    else if (menuState === 'loadout') drawLoadoutScreen(t);
    else if (menuState === 'scores') drawScoresScreen(t);
    else if (menuState === 'stats') drawStatsScreen(t);
    else if (menuState === 'options') drawOptionsScreen(t);
    else if (menuState === 'nameentry') drawNameEntryBottom(t);
    else if (menuState === 'gameover') drawGameOverBottom(t);
    ctx.restore();
  }
  uiDrawStylus(t);
  drawToasts();
  ctx.restore();
}

function drawGameplay(t){
  drawTopScreen(t);
  drawBezel(t);
  drawBottomScreen(t);

  for(const ft of fadingTrails){
    const baseA=ft.life/ft.maxLife;
    for(let i=1;i<ft.points.length;i++){
      const a=ft.points[i-1],b=ft.points[i];
      const midY = (a.y + b.y) * 0.5;
      const cloud = cloudAlphaAtY(midY);
      drawJaggedTrail(a.x,a.y,b.x,b.y,ft.dimCol,1,baseA*(i/ft.points.length)*cloud);
    }
  }
  for(const e of enemies){
    if(e.trail.length<2)continue;
    const T=ETYPES[e.type];
    const trLen=e.trail.length;
    for(let i=1;i<trLen;i++){
      const a=e.trail[i-1],b=e.trail[i];
      const midY=(a.y+b.y)*0.5;
      const cloud = cloudAlphaAtY(midY);
      const segT=i/trLen;
      drawJaggedTrail(a.x,a.y,b.x,b.y,segT>0.7?T.trailCol:T.trailDim,segT>0.5?1:2, cloud);
    }
    const last=e.trail[trLen-1];
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = cloudAlphaAtY(last.y);
    ctx.fillStyle=P.wht;
    ctx.fillRect(Math.round(last.x),Math.round(last.y),1,1);
    ctx.globalAlpha = prevA;
  }
  if(boss){ drawBossBackdrop(); ctx.save(); ctx.translate(0, boss.offY || 0); boss.draw(t); ctx.restore(); drawBossMist(t); }
  for(const b of booms)b.draw();
  drawParticles();
  for(const s of shots){
    const tt=clamp(s.t/s.dur,0,1);
    const cx=s.x0+(s.x1-s.x0)*tt,cy=s.y0+(s.y1-s.y0)*tt;
    const cloudMid = cloudAlphaAtY((s.y0 + cy) * 0.5);
    const shc = shotColors(t);
    drawShotTrail(s.x0,s.y0,cx,cy,shc,cloudMid,t);
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = cloudAlphaAtY(cy);
    drawShotHead(cx, cy);
    ctx.globalAlpha = prevA;
  }
  for(const e of enemies){
    const spr=SPR[ETYPES[e.type].spr];
    const wob=Math.sin(e.wobble)*0.5;
    const cloud = cloudAlphaAtY(e.y);
    if (cloud < 0.85){
      ctx.globalAlpha = (1 - cloud) * 1.2;
      ctx.fillStyle = P.wht;
      const w=spr.w, h=spr.h;
      const ox=Math.round(e.x-w/2), oy=Math.round(e.y+wob-h/2);
      for(let j=0;j<h;j++){
        const row=spr.data[j];
        for(let i=0;i<w;i++){
          if(row[i]){
            ctx.fillRect(ox+i-1,oy+j,1,1);
            ctx.fillRect(ox+i+1,oy+j,1,1);
            ctx.fillRect(ox+i,oy+j-1,1,1);
            ctx.fillRect(ox+i,oy+j+1,1,1);
          }
        }
      }
      ctx.globalAlpha = 1;
    }
    drawSprite2600(spr,e.x,e.y+wob,cloud);
    const T = ETYPES[e.type];
    if (e.type === 'chute' && e.opened) drawCanopy(e, t, cloud);
    if (e.type === 'satellite') drawSatelliteFx(e, t);
    if (T.shield) drawPlatformFx(e, t, spr, cloud);
    if (T.splitAt && !e.hasSplit){
      const progress = (e.y - e.startY) / e.totalFall;
      if (progress > T.splitAt - 0.12 && Math.sin(t * 20) > 0){
        ctx.fillStyle = P.wht;
        ctx.fillRect(Math.round(e.x) - 4, Math.round(e.y) - 4, 8, 1);
        ctx.fillRect(Math.round(e.x) - 4, Math.round(e.y) + 4, 8, 1);
      }
    }
  }
  drawCrates(t);
  drawImpactWarnings(t);
  drawHazard(t);
  for(const inst of installations)drawHabitatDome(inst,t);
  for(let i=0;i<turrets.length;i++){ if (turrets[i].alive) drawTurret(turrets[i],turretBarrels[i],_cachedActiveTurret); else drawTurretWreck(turrets[i], t); }
  drawSnowfall();
  if(boss&&boss.drawFront){ ctx.save(); ctx.translate(0, boss.offY || 0); boss.drawFront(t); ctx.restore(); }
  drawEdgeWarns(t);
  drawPhraseLabel(t);

  for(const p0 of popups){
    const p = (p0.y > SH - 10 && p0.y < BOT + 8) ? Object.assign({}, p0, { y: SH - 14 }) : p0;
    const a=1-p.t/p.dur;
    const txt=String(p.text);
    const prevA = ctx.globalAlpha;
    if (p.big){
      const w = textW2x(txt);
      ctx.globalAlpha=a*0.7;
      drawText2x(txt, Math.round(p.x - w/2 + 2), Math.round(p.y + 2), P.blk);
      ctx.globalAlpha=a;
      drawText2x(txt, Math.round(p.x - w/2), Math.round(p.y), p.col);
    } else {
      const tw=textW(txt);
      ctx.globalAlpha=a*0.6;
      drawText(txt,Math.round(p.x-tw/2+1),Math.round(p.y+1),P.blk);
      ctx.globalAlpha=a;
      drawText(txt,Math.round(p.x-tw/2),Math.round(p.y),p.col,a);
    }
    ctx.globalAlpha=prevA;
  }

  if (dangerLevel > 0.02){
    const prevA = ctx.globalAlpha;
    for (let i = 0; i < 5; i++){
      ctx.globalAlpha = dangerLevel * 0.28 * (1 - i/5);
      ctx.fillStyle = P.red;
      ctx.fillRect(0, BOT + i, W, 1);
      ctx.fillRect(0, H - 1 - i, W, 1);
      ctx.fillRect(i, BOT, 1, SH);
      ctx.fillRect(W - 1 - i, BOT, 1, SH);
    }
    const cl = 8 + Math.floor(dangerLevel * 10);
    ctx.globalAlpha = dangerLevel * 0.7;
    ctx.fillStyle = P.red;
    ctx.fillRect(0, BOT, cl, 1);
    ctx.fillRect(0, BOT, 1, cl);
    ctx.fillRect(W - cl, BOT, cl, 1);
    ctx.fillRect(W - 1, BOT, 1, cl);
    ctx.fillRect(0, H - 1, cl, 1);
    ctx.fillRect(0, H - cl, 1, cl);
    ctx.fillRect(W - cl, H - 1, cl, 1);
    ctx.fillRect(W - 1, H - cl, 1, cl);
    ctx.globalAlpha = prevA;
  }

  if(warningT>0){
    const a=warningT*0.5;
    const prevA = ctx.globalAlpha;
    for(let y=0;y<8;y++){
      ctx.globalAlpha=a*(1-y/8)*0.5;
      ctx.fillStyle=P.red;
      ctx.fillRect(0,BOT+y,W,1);
    }
    ctx.globalAlpha=prevA;
  }
  drawAim(t);
  drawHUD(t);
  drawWaveSummary(t);
  drawEffects(t);
  drawBossBar(t);
  drawBossWarning(t);

  if(waveBannerT>0){
    const el = bannerDur - waveBannerT;
    const a=Math.min(1,waveBannerT*1.5)*Math.min(1,el*3);
    const s = bannerMain;
    const tw2=textW2x(s);
    const cy=SH-40;
    const slide = Math.round((1 - Math.min(1, el * 3)) * -40);
    const prevA = ctx.globalAlpha;
    const barH = bannerSub ? 26 : 16;
    ctx.globalAlpha=a*0.9;
    ctx.fillStyle=P.blk;
    ctx.fillRect(0, cy-6, W, barH);
    ctx.fillStyle = P.yel;
    ctx.fillRect(0, cy-6, 3, barH);
    ctx.fillRect(W - 3, cy-6, 3, barH);
    drawStar(7, cy - 6 + Math.round((barH - 7) / 2), P.rrd);
    drawStar(W - 14, cy - 6 + Math.round((barH - 7) / 2), P.rrd);
    ctx.globalAlpha=a;
    for(let i=0;i<s.length;i++){
      const c = RAINBOW[(i+Math.floor(t*8))%7];
      drawText2x(s[i], Math.round((W-tw2)/2) + i*8 + slide, cy, c);
    }
    if (bannerSub){
      drawText(bannerSub, Math.round((W-textW(bannerSub))/2) + slide, cy + 14, P.lblu);
    }
    ctx.globalAlpha=prevA;
  }
}

function drawImpactWarnings(t){
  if (modBlind) return;
  for (const e of enemies){
    if (e.vy <= 0 || e.dead) continue;
    if (e.x < -4 || e.x > W + 4) continue;
    const Tw = ETYPES[e.type];
    let timeToGround;
    if (Tw.ay){
      timeToGround = (-e.vy + Math.sqrt(e.vy * e.vy + 2 * Tw.ay * (GROUND - e.y))) / Tw.ay;
    } else {
      timeToGround = (GROUND - e.y) / e.vy;
    }
    if (timeToGround < 0 || timeToGround > 1.6) continue;
    if (e.y < CLOUD_TOP) continue;
    const impactX = clamp(e.x + e.vx * timeToGround, 0, W-1);
    const intensity = 1 - timeToGround / 1.6;
    const blink = Math.sin(t * 14 + e.x * 0.1) > -0.3 ? 1 : 0.35;
    const prevA = ctx.globalAlpha;
    ctx.globalAlpha = 0.35 + intensity * 0.55 * blink;
    const col = intensity > 0.7 ? P.wht : P.red;
    ctx.fillStyle = col;
    const ix = Math.round(impactX);
    ctx.fillRect(ix - 1, GROUND - 4, 3, 2);
    ctx.fillRect(ix - 2, GROUND - 2, 5, 2);
    ctx.globalAlpha *= 0.35;
    ctx.fillRect(ix, GROUND - 8, 1, 4);
    ctx.globalAlpha = prevA;
  }
}

function drawTopFx(t){
  const fx = currentEnv.topFx;
  if (fx === 'aurora'){
    for (let i = 0; i < 3; i++){
      const yBase = 20 + i * 8;
      const amp = 2 + i;
      for (let x = 0; x < W; x++){
        const wobble = Math.sin(x * 0.08 + t * 1.2 + i * 2) * amp;
        const y = Math.round(yBase + wobble);
        const inten = 0.5 + Math.sin(x * 0.12 + t * 2 + i) * 0.5;
        if (inten > 0.5){
          ctx.fillStyle = i === 0 ? P.pur : (i === 1 ? P.lpur : P.lmag);
          ctx.globalAlpha = 0.35 + inten * 0.3;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  } else if (fx === 'ember'){
    for (let i = 0; i < 28; i++){
      const sp = 10 + (i % 4) * 5;
      const y = SH - 40 - ((t * sp + i * 31) % (SH - 60));
      const x = (i * 53 + Math.sin(t * 0.8 + i) * 6 + 256) % W;
      ctx.fillStyle = i % 3 === 0 ? P.yel : (i % 3 === 1 ? P.org : P.red);
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  } else if (fx === 'frost'){
    for (let i = 0; i < 22; i++){
      const y = (i * 41 + t * (5 + (i % 3) * 2)) % (SH - 50);
      const x = (i * 67 + Math.sin(t * 0.6 + i * 2) * 8 + 256) % W;
      ctx.fillStyle = (Math.floor(t * 3 + i) % 4 === 0) ? P.wht : P.lgrn;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  } else if (fx === 'shimmer'){
    for (let i = 0; i < 3; i++){
      const yBase = 26 + i * 9;
      for (let x = 0; x < W; x += 2){
        const wobble = Math.sin(x * 0.05 + t * 0.9 + i * 2.3) * (2 + i);
        const inten = 0.5 + Math.sin(x * 0.1 + t * 1.6 + i) * 0.5;
        if (inten > 0.55){
          ctx.fillStyle = i === 0 ? P.dmag : (i === 1 ? P.mag : P.lmag);
          ctx.globalAlpha = 0.4 + inten * 0.3;
          ctx.fillRect(x, Math.round(yBase + wobble), 2, 1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawGroundFx(t){
  const e = currentEnv, fx = e.groundFx;
  if (fx === 'tar'){
    ctx.fillStyle = P.wht; ctx.fillRect(0, GROUND, W, 1);
    for (let x = 0; x < W; x += 2){
      const phase = Math.sin(x * 0.18 + t * 2) + Math.sin(x * 0.07 + t * 0.8);
      if (phase > 1.2){ ctx.fillStyle = P.lblu; ctx.fillRect(x, GROUND + 1, 1, 1); }
      else if (phase > 0.8){ ctx.fillStyle = P.lmag; ctx.fillRect(x, GROUND + 1, 1, 1); }
      else if (phase > 0.4){ ctx.fillStyle = P.blu; ctx.fillRect(x, GROUND + 1, 1, 1); }
    }
    ctx.fillStyle = P.dblu;
    ctx.fillRect(0, GROUND + 2, W, H - GROUND - 2);
    ctx.fillStyle = P.dpur;
    for (let i = 0; i < 6; i++){
      const y = GROUND + 5 + i;
      const xStart = (i * 47 + Math.floor(t * 6)) % W;
      ctx.fillRect(xStart, y, 12, 1);
      ctx.fillRect((xStart + 40) % W, y, 8, 1);
    }
    for (let i = 0; i < 4; i++){
      const y = GROUND + 4 + i * 3;
      const xStart = (i * 73 + Math.floor(t * 10)) % W;
      for (let k = 0; k < 10; k++){
        const x = (xStart + k * 2) % W;
        if (k < 6){
          ctx.fillStyle = k < 3 ? P.pnk : P.lmag;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return;
  }
  ctx.fillStyle = e.ground0; ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = e.ground1; ctx.fillRect(0, GROUND, W, 4);
  ctx.fillStyle = e.ground2; ctx.fillRect(0, GROUND + 4, W, 2);
  if (fx === 'lava'){
    for (let i = 0; i < 10; i++){
      const x0 = (i * 29 + 7) % W;
      const w = 6 + (i % 3) * 3;
      const y = GROUND + 7 + (i % 3) * 2;
      ctx.fillStyle = Math.sin(t * 3 + i * 1.7) > 0 ? P.yel : P.org;
      ctx.fillRect(x0, y, w, 1);
      ctx.fillStyle = P.red;
      ctx.fillRect(x0 + 1, y + 1, Math.max(1, w - 2), 1);
    }
  } else if (fx === 'frost'){
    for (let i = 0; i < 14; i++){
      if (Math.floor(t * 4 + i * 3) % 5 === 0){
        ctx.fillStyle = P.wht;
        ctx.fillRect((i * 37 + 11) % W, GROUND + 6 + (i % 4) * 2, 1, 1);
      }
    }
  } else if (fx === 'nitro'){
    for (let i = 0; i < 6; i++){
      const x0 = (i * 51 + Math.floor(t * (6 + i))) % W;
      ctx.fillStyle = i % 2 ? P.pnk : P.lmag;
      ctx.fillRect(x0, GROUND + 7 + (i % 3) * 2, 8, 1);
    }
  }
}

function drawTopScreen(t){
  ctx.fillStyle=P.blk; ctx.fillRect(0,0,W,SH);
  drawTopFx(t);
  drawStars(t);
  if (saturnFrames.length > 0){
    const frameIdx = Math.floor(t * 3) % SAT_FRAMES;
    const frame = saturnFrames[frameIdx];
    if (frame){
      const drawSize = Math.round(SAT_OFF * currentEnv.saturnScale);
      ctx.drawImage(frame, 0, 0, SAT_OFF, SAT_OFF,
        Math.round(currentEnv.saturnCX - drawSize/2),
        Math.round(currentEnv.saturnCY - drawSize/2),
        drawSize, drawSize);
    }
  }
  drawAtmosphere();
  drawCloudBand(t);
}

function drawBottomScreen(t){
  const skyH=HORIZON-BOT;
  const skyBands=currentEnv.skyBands.length;
  const bandH=Math.ceil(skyH/skyBands);
  for(let i=0;i<skyBands;i++){
    ctx.fillStyle=currentEnv.skyBands[i];
    const y0=BOT+i*bandH;
    const h=(i===skyBands-1)?skyH-i*bandH:bandH;
    ctx.fillRect(0,y0,W,h);
  }
  for(let i=0;i<3;i++){
    ctx.fillStyle = [P.wht, P.gry, P.blk][i];
    ctx.fillRect(0, BOT + i*3, W, 3);
  }
  for(let i=0;i<30;i++){
    const sx=(i*89)%W;
    const sy=BOT+12+((i*37)%Math.floor(skyH-16));
    const depth=(sy-BOT)/skyH;
    if(depth<0.7){
      ctx.fillStyle=depth<0.3?P.wht:(depth<0.5?P.gry:P.blk);
      const p2=ctx.globalAlpha;
      ctx.globalAlpha=0.4+(1-depth)*0.6;
      ctx.fillRect(sx,sy,1,1);
      ctx.globalAlpha=p2;
    }
  }
  if(worldCanvas) ctx.drawImage(worldCanvas, 0, HORIZON-20);
  drawGroundFx(t);
}

// Flyers announce themselves: chevrons flash at the edge they are about to enter from
function drawEdgeWarns(t){
  for (const w of edgeWarns){
    if (Math.sin(w.t * 28) < -0.2) continue;
    const dir = w.side === 0 ? 1 : -1, x0 = w.side === 0 ? 3 : W - 4, y = Math.round(w.y);
    for (let k = 0; k < 3; k++){
      const x = x0 + dir * k * 4;
      ctx.fillStyle = P.blk; ctx.fillRect(x + 1, y - 1, 1, 3);
      ctx.fillStyle = k === 2 ? P.wht : P.yel;
      ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x + dir, y - 1, 1, 1); ctx.fillRect(x + dir * 2, y, 1, 1);
      ctx.fillRect(x + dir, y + 1, 1, 1); ctx.fillRect(x, y + 2, 1, 1);
    }
  }
}
// The name of the pattern that just started, so the rhythm of a wave can be learned
function drawPhraseLabel(t){
  if (choreo.labelT <= 0 || !choreo.label) return;
  const a = Math.min(1, choreo.labelT * 1.6);
  const y = boss && boss.state !== 'away' ? 36 : 29;
  const tw = textW(choreo.label);
  drawText(choreo.label, Math.round((W - tw) / 2) + 1, y + 1, P.blk, a);
  drawText(choreo.label, Math.round((W - tw) / 2), y, P.lblu, a);
}

// Unlockable city buildings: each one is its own small sprite, not a recolor
function drawCityFlag(x, topY, t, seed){
  const wv = Math.floor(t * 3 + seed * 0.1) % 2;
  ctx.fillStyle = P.gry; ctx.fillRect(x, topY, 1, 6);
  ctx.fillStyle = P.rrd; ctx.fillRect(x + 1, topY, 4, 3); ctx.fillRect(x + 5, topY + wv, 1, 2);
  ctx.fillStyle = P.yel; ctx.fillRect(x + 1, topY, 1, 1);
}
function drawCityBuilding(kind, cx, gy, r, t, inst){
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const sd = Math.floor(inst.x);
  const hs = k => (sd * 7 + k * 13) % 100;
  const lit = k => Math.sin(t * 2 + hs(k)) > -0.35;
  const win = currentEnv.winCol;
  if (kind === 1){
    // TOWER: stepped gold skyscraper with a star on the spire
    let y = gy;
    const tiers = [[r, 6], [r - 2, 6], [r - 4, 5]];
    for (let i = 0; i < tiers.length; i++){
      const hw = tiers[i][0], h = tiers[i][1];
      y -= h;
      R(cx - hw, y, hw * 2, h, P.org);
      R(cx - hw, y, hw * 2, 1, P.yel);
      R(cx + hw - 1, y + 1, 1, h - 1, P.dorg);
      R(cx - hw, y + h - 1, hw * 2, 1, P.dorg);
      for (let x = cx - hw + 2, k = 0; x < cx + hw - 2; x += 3, k++) R(x, y + 2, 1, 2, lit(i * 5 + k) ? win : P.blk);
    }
    R(cx, y - 6, 1, 6, P.yel);
    R(cx, y - 9, 1, 1, P.yel); R(cx - 1, y - 8, 3, 1, P.yel); R(cx, y - 7, 1, 1, P.yel);
    drawCityFlag(cx + 3, y - 6, t, sd);
  } else if (kind === 2){
    // REACTOR: twin cooling towers with drifting steam
    const rows = [3, 3, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4];
    for (const off of [-5, 5]){
      const x0 = cx + off;
      for (let j = 0; j < rows.length; j++){
        const hw = rows[j], y = gy - rows.length + j;
        R(x0 - hw, y, hw * 2, 1, P.gry);
        R(x0 - hw, y, 1, 1, P.wht);
        R(x0 + hw - 1, y, 1, 1, P.dblu);
      }
      R(x0 - 3, gy - rows.length, 6, 1, P.rrd);
      for (let i = 0; i < 3; i++){
        const ph = (t * 5 + i * 3.4 + off) % 10;
        ctx.globalAlpha = 1 - ph / 10;
        R(x0 - 1 + Math.sin(t * 1.5 + i + off) * 2, gy - rows.length - 2 - ph, 3, 1, P.wht);
        ctx.globalAlpha = 1;
      }
    }
    R(cx - 1, gy - 5, 2, 5, P.dblu);
    drawCityFlag(cx, gy - 12 - 5 + 0, t, sd);
  } else if (kind === 3){
    // ARCOLOGY: three towers of different heights with blinking neon windows
    const bars = [[cx - 8, 5, 13], [cx - 3, 6, 20], [cx + 3, 5, 11]];
    const neon = [P.lblu, P.lmag, P.lgrn];
    for (let b = 0; b < bars.length; b++){
      const x = bars[b][0], w = bars[b][1], h = bars[b][2], top = gy - h;
      R(x, top, w, h, P.dpur);
      R(x, top, 1, h, P.pur);
      R(x, top, w, 1, P.lmag);
      for (let y = top + 3, row = 0; y < gy - 2; y += 3, row++){
        for (let xx = x + 1, c = 0; xx < x + w - 1; xx += 2, c++){
          if (lit(b * 31 + row * 5 + c)) R(xx, y, 1, 1, neon[(row + c + b) % 3]);
        }
      }
    }
    R(cx, gy - 25, 1, 5, P.gry);
    if (Math.sin(t * 5 + sd) > 0) R(cx, gy - 26, 1, 1, P.rrd);
    drawCityFlag(cx + 5, gy - 17, t, sd);
  } else if (kind === 4){
    // FOUNDRY: sawtooth roof, two striped smokestacks and a red banner
    const bw = r;
    R(cx - bw, gy - 8, bw * 2, 8, P.dred);
    R(cx - bw, gy - 8, bw * 2, 1, P.red);
    R(cx + bw - 1, gy - 7, 1, 7, P.blk);
    const tw = Math.floor(bw * 2 / 3);
    for (let i = 0; i < 3; i++){
      const x0 = cx - bw + i * tw;
      for (let k = 0; k < tw; k++){
        const h = 1 + Math.floor(3 * k / tw);
        R(x0 + k, gy - 8 - h, 1, h, P.red);
      }
      R(x0 + tw - 1, gy - 12, 1, 4, P.pnk);
    }
    for (const sx of [cx - bw + 1, cx + bw - 4]){
      R(sx, gy - 18, 3, 10, P.gry);
      R(sx, gy - 18, 3, 1, P.rrd); R(sx, gy - 15, 3, 1, P.rrd);
      R(sx + 2, gy - 17, 1, 9, P.dblu);
      for (let i = 0; i < 3; i++){
        const ph = (t * 5 + i * 3.1 + sx) % 9;
        ctx.globalAlpha = 1 - ph / 9;
        R(sx + 1 + Math.sin(t * 1.3 + i + sx) * 2, gy - 20 - ph, 2, 1, P.gry);
        ctx.globalAlpha = 1;
      }
    }
    R(cx - 1, gy - 4, 3, 4, P.blk);
    for (let x = cx - bw + 3, k = 0; x < cx + bw - 3; x += 4, k++) if (Math.abs(x - cx) > 2) R(x, gy - 6, 2, 1, lit(k) ? win : P.blk);
    drawCityFlag(cx, gy - 18, t, sd);
  } else {
    // PAGODA: three roofs, each wider than the wall below it
    let y = gy;
    const tiers = [[r - 3, r + 1], [r - 5, r - 1], [r - 7, r - 4]];
    for (let i = 0; i < tiers.length; i++){
      const wh = Math.max(1, tiers[i][0]), rh = tiers[i][1];
      y -= 4;
      R(cx - wh, y, wh * 2, 4, P.tan);
      R(cx + wh - 1, y, 1, 4, P.org);
      R(cx - 1, y + 1, 2, 3, P.blk);
      if (wh > 3) { R(cx - wh + 1, y + 1, 1, 2, lit(i) ? win : P.blk); R(cx + wh - 2, y + 1, 1, 2, lit(i + 7) ? win : P.blk); }
      y -= 2;
      R(cx - rh, y + 1, rh * 2, 1, P.dgrn);
      R(cx - rh + 1, y, rh * 2 - 2, 1, P.grn);
      R(cx - rh, y, 1, 1, P.lgrn); R(cx + rh - 1, y, 1, 1, P.lgrn);
      R(cx - rh + 3, y - 1, rh * 2 - 6, 1, P.lgrn);
    }
    R(cx, y - 4, 1, 4, P.yel);
    R(cx, y - 5, 1, 1, P.wht);
    drawCityFlag(cx + 1, y - 10, t, sd);
  }
}

function drawHabitatDome(inst,t,baseYArg){
  const cx = inst.x; const baseY = baseYArg === undefined ? GROUND : baseYArg; const r = inst.size;
  const domeColors = currentEnv.domeColors;
  if(!inst.alive){
    ctx.fillStyle=currentEnv.ground0;
    ctx.fillRect(cx - r, baseY - 1, r*2, 1);
    ctx.fillRect(cx - r + 1, baseY - 2, r, 1);
    ctx.fillRect(cx + 1, baseY - 2, r - 2, 1);
    ctx.fillRect(cx - 2, baseY - 3, 3, 1);
    ctx.fillStyle=P.blk;
    ctx.fillRect(cx - r + 2, baseY - 2, 2, 1);
    ctx.fillRect(cx + r - 4, baseY - 3, 2, 1);
    ctx.fillRect(cx, baseY - 4, 1, 1);
    return;
  }
  ctx.fillStyle = P.blk;
  ctx.fillRect(cx - r - 3, baseY, r*2 + 6, 1);
  ctx.fillStyle = currentEnv.ground0;
  ctx.fillRect(cx - r - 3, baseY - 2, r*2 + 6, 2);
  ctx.fillStyle = currentEnv.ground1;
  ctx.fillRect(cx - r - 2, baseY - 4, r*2 + 4, 2);
  ctx.fillStyle = currentEnv.ground2;
  ctx.fillRect(cx - r - 2, baseY - 5, r*2 + 4, 1);
  ctx.fillStyle = P.wht;
  ctx.fillRect(cx - r + 1, baseY - 5, r*2 - 2, 1);
  if (loadout.city > 0){ drawCityBuilding(loadout.city, cx, baseY - 5, r, t, inst); return; }
  const domeBase = baseY - 5;
  const domeH = (f) => { const c = Math.max(-1, Math.min(1, f)); return Math.sqrt(Math.max(0, 1 - c*c)); };
  const panels = [
    { l: -1.00, r: -0.60, col: domeColors[0] },
    { l: -0.60, r: -0.20, col: domeColors[1] },
    { l: -0.20, r:  0.20, col: domeColors[2] },
    { l:  0.20, r:  0.60, col: domeColors[3] },
    { l:  0.60, r:  1.00, col: domeColors[4] },
  ];
  for(const panel of panels){
    const xL = Math.round(cx + panel.l * r);
    const xR = Math.round(cx + panel.r * r);
    ctx.fillStyle = panel.col;
    for(let x = xL; x < xR; x++){
      const f = (x - cx) / r;
      const topY = domeBase - domeH(f) * r;
      const yStart = Math.round(topY);
      ctx.fillRect(x, yStart, 1, domeBase - yStart);
    }
  }
  ctx.fillStyle = P.blk;
  for(let i = 1; i < panels.length; i++){
    const f = panels[i].l;
    const x = Math.round(cx + f * r);
    const topY = Math.round(domeBase - domeH(f) * r);
    for(let y = topY; y < domeBase; y++) ctx.fillRect(x, y, 1, 1);
  }
  ctx.fillStyle = P.wht;
  for(let x = -r; x <= r; x++){
    const f = x / r;
    const topY = domeBase - domeH(f) * r;
    ctx.fillRect(Math.round(cx + x), Math.round(topY), 1, 1);
  }
  for(let wy = 0; wy < 2; wy++){
    for(let wx = 0; wx < 3; wx++){
      const xOff = (wx - 1) * 4;
      const yOff = -3 - wy * 4;
      const winX = Math.round(cx + xOff - 1);
      const winY = Math.round(domeBase + yOff);
      const f = (winX + 1 - cx) / r;
      const topY = domeBase - domeH(f) * r;
      if (winY < topY + 1) continue;
      const hash = (Math.floor(inst.x) * 7 + wx * 13 + wy * 31) % 100;
      const lit = Math.sin(t * 2 + hash) > -0.35;
      if (lit){
        ctx.fillStyle = currentEnv.winCol;
        ctx.fillRect(winX, winY, 2, 2);
        if (hash % 3 === 0){ ctx.fillStyle = P.wht; ctx.fillRect(winX, winY, 1, 1); }
      } else {
        ctx.fillStyle = currentEnv.ground0;
        ctx.fillRect(winX, winY, 2, 2);
      }
    }
  }
  // Small red flag on a pole
  const poleTop = domeBase - r - 8;
  ctx.fillStyle = P.gry;
  ctx.fillRect(cx, poleTop, 1, 8);
  const wv = Math.floor(t * 3 + inst.x * 0.1) % 2;
  ctx.fillStyle = P.rrd;
  ctx.fillRect(cx + 1, poleTop, 4, 3);
  ctx.fillRect(cx + 5, poleTop + wv, 1, 2);
  ctx.fillStyle = P.yel;
  ctx.fillRect(cx + 1, poleTop, 1, 1);
}

// A destroyed turret: a broken stump with a flickering fire and a rebuild gauge
function drawTurretWreck(tr, t){
  const x = Math.round(tr.x), y = Math.round(tr.y);
  const gy = GROUND;
  ctx.fillStyle = P.blk; ctx.fillRect(x - 11, gy - 9, 22, 7);
  ctx.fillStyle = P.dolk; ctx.fillRect(x - 10, gy - 8, 20, 2);
  ctx.fillStyle = P.gry;
  ctx.fillRect(x - 9, gy - 6, 4, 3); ctx.fillRect(x - 3, gy - 7, 3, 4); ctx.fillRect(x + 3, gy - 6, 5, 3);
  ctx.fillStyle = P.dred;
  ctx.fillRect(x - 6, gy - 4, 12, 2);
  if (Math.sin(t * 24 + x) > -0.3){ ctx.fillStyle = P.org; ctx.fillRect(x - 2, gy - 11, 3, 3); ctx.fillStyle = P.yel; ctx.fillRect(x - 1, gy - 10, 1, 2); }
  else { ctx.fillStyle = P.red; ctx.fillRect(x - 1, gy - 10, 2, 2); }
  const f = clamp(1 - tr.rebuildT / TURRET_REBUILD, 0, 1);       // rebuild gauge
  ctx.fillStyle = P.blk; ctx.fillRect(x - 9, gy + 3, 18, 3);
  ctx.fillStyle = P.dblu; ctx.fillRect(x - 8, gy + 4, 16, 1);
  ctx.fillStyle = P.lgrn; ctx.fillRect(x - 8, gy + 4, Math.round(16 * f), 1);
}
function drawTurret(t,barrel,activeTurret,gyArg){
  const x = Math.round(t.x), y = Math.round(t.y);
  const alive = true;
  const bx = Math.round(barrel.x), by = Math.round(barrel.y);
  const active = activeTurret === t;
  if (alive){
    const dx = bx - x, dy = by - y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++){
      const ti = i / steps;
      const px = x + dx * ti;
      const py = y + dy * ti;
      ctx.fillStyle = P.blk;
      ctx.fillRect(Math.round(px + nx), Math.round(py + ny), 1, 1);
      ctx.fillStyle = P.gry;
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
      ctx.fillStyle = P.wht;
      ctx.fillRect(Math.round(px - nx), Math.round(py - ny), 1, 1);
    }
    ctx.fillStyle = P.yel;
    ctx.fillRect(bx - 1, by - 1, 3, 3);
    ctx.fillStyle = P.wht;
    ctx.fillRect(bx, by, 1, 1);
  }
  if (t.flash > 0){
    const f = t.flash / 0.10;
    const p2 = ctx.globalAlpha;
    ctx.globalAlpha = f;
    ctx.fillStyle = P.yel;
    ctx.fillRect(bx - 2, by - 2, 5, 5);
    ctx.fillStyle = P.wht;
    ctx.fillRect(bx - 1, by - 1, 3, 3);
    ctx.fillRect(bx, by, 1, 1);
    ctx.fillStyle = P.yel;
    ctx.fillRect(bx - 3, by, 1, 1);
    ctx.fillRect(bx + 3, by, 1, 1);
    ctx.fillRect(bx, by - 3, 1, 1);
    ctx.fillRect(bx, by + 3, 1, 1);
    ctx.globalAlpha = p2;
  }
  // Gun head
  ctx.fillStyle = P.blk;
  ctx.fillRect(x - 6, y + 3, 12, 1);
  ctx.fillStyle = currentEnv.ground0;
  ctx.fillRect(x - 6, y + 1, 12, 2);
  ctx.fillStyle = currentEnv.ground1;
  ctx.fillRect(x - 5, y - 1, 10, 2);
  ctx.fillStyle = P.wht;
  ctx.fillRect(x - 3, y - 2, 6, 1);
  ctx.fillStyle = currentEnv.ground0;
  ctx.fillRect(x - 1, y - 2, 2, 1);
  // Deck, struts and footing
  const gy = gyArg === undefined ? GROUND : gyArg;
  ctx.fillStyle = P.blk;
  ctx.fillRect(x - 11, y + 4, 22, 3);
  ctx.fillStyle = P.gry;
  ctx.fillRect(x - 10, y + 4, 20, 1);
  ctx.fillStyle = P.rrd;
  ctx.fillRect(x - 10, y + 5, 20, 1);
  ctx.fillStyle = P.dblu;
  ctx.fillRect(x - 10, y + 6, 20, 1);
  // Lattice tower: two legs spreading to the footing, with cross braces
  const topY = y + 7, botY = gy - 2, span = Math.max(1, botY - topY);
  for (let yy = topY; yy < botY; yy++){
    const k = (yy - topY) / span;
    const hw = Math.round(3 + k * 5);
    ctx.fillStyle = P.blk;
    ctx.fillRect(x - hw - 1, yy, 3, 1); ctx.fillRect(x + hw - 1, yy, 3, 1);
    ctx.fillStyle = P.gry;
    ctx.fillRect(x - hw, yy, 1, 1); ctx.fillRect(x + hw, yy, 1, 1);
    ctx.fillStyle = P.wht;
    ctx.fillRect(x - hw, yy, 1, 1);
  }
  for (let seg = 0; seg < 3; seg++){
    const y0 = topY + Math.floor(span * seg / 3), y1 = topY + Math.floor(span * (seg + 1) / 3);
    for (let yy = y0; yy < y1; yy++){
      const k0 = (yy - topY) / span;
      const hw = Math.round(3 + k0 * 5);
      const f = (yy - y0) / Math.max(1, y1 - y0);
      const dx = Math.round(-hw + f * hw * 2);
      ctx.fillStyle = P.dblu; ctx.fillRect(x + dx, yy, 1, 1);
      ctx.fillStyle = P.lblu; ctx.fillRect(x - dx, yy, 1, 1);
    }
    ctx.fillStyle = P.rrd;
    const hwb = Math.round(3 + ((y1 - topY) / span) * 5);
    ctx.fillRect(x - hwb, y1 - 1, hwb * 2 + 1, 1);
  }
  ctx.fillStyle = P.blk;
  ctx.fillRect(x - 10, gy - 2, 20, 2);
  ctx.fillStyle = currentEnv.ground1;
  ctx.fillRect(x - 9, gy - 2, 18, 1);
  // Red flag on the deck rail
  ctx.fillStyle = P.gry;
  ctx.fillRect(x + 9, y - 6, 1, 10);
  const wv = Math.floor(performance.now() / 330 + x * 0.1) % 2;
  ctx.fillStyle = P.rrd;
  ctx.fillRect(x + 10, y - 6, 4, 3);
  ctx.fillRect(x + 14, y - 6 + wv, 1, 2);
  ctx.fillStyle = P.yel;
  ctx.fillRect(x + 10, y - 6, 1, 1);
  // reload gauge above the gun: fills as the turret rearms, and flashes red if you fire while it is empty
  if (t.cd > 0 || t.dry > 0){
    const f = t.cd > 0 ? clamp(1 - t.cd / (REARM * (fxRapid > 0 ? 0.25 : 1) * (modSlow ? 1.5 : 1)), 0, 1) : 1;
    ctx.fillStyle = P.blk; ctx.fillRect(x - 8, y - 13, 16, 3);
    ctx.fillStyle = t.dry > 0 && Math.sin(performance.now() / 30) > 0 ? P.rrd : P.dblu; ctx.fillRect(x - 7, y - 12, 14, 1);
    ctx.fillStyle = f > 0.75 ? P.lgrn : P.yel; ctx.fillRect(x - 7, y - 12, Math.round(14 * f), 1);
  }
  if (active && t.cd <= 0 && menuState === 'game'){
    const pulse = Math.sin(performance.now()/125) > 0;
    ctx.fillStyle = pulse ? P.wht : P.yel;
    ctx.fillRect(x - 1, y - 7, 2, 1);
    ctx.fillRect(x - 2, y - 6, 4, 1);
  }
}

function drawBezel(t){
  ctx.fillStyle=P.blk;ctx.fillRect(0,SH,W,GAP);
  ctx.fillStyle=currentEnv.ground0;ctx.fillRect(0,BOT-6,W,6);
  ctx.fillRect(0,BOT,W,1);ctx.fillRect(0,H-1,W,1);
  ctx.fillRect(0,BOT,1,SH);ctx.fillRect(W-1,BOT,1,SH);
}

function drawAim(t){
  const blink = Math.sin(t*14) > -0.35;
  const pulse = 1+Math.sin(t*8)*0.5;
  drawReticle(aim.x,mirrorY(aim.y),P.gry,false,pulse);
  drawReticle(aim.x,aim.y,blink ? P.wht : P.yel,true,pulse);
}

function drawReticle(x,y,col,main,pulse,styleOverride){
  x=Math.round(x);y=Math.round(y);ctx.fillStyle=col;
  const style = styleOverride !== undefined ? styleOverride : loadout.reticle;
  const r = main ? 6 : 4;
  if (style === 1){
    ctx.fillRect(x,y,1,1);
    if (main && pulse > 1){
      ctx.fillRect(x-1,y,1,1);
      ctx.fillRect(x+1,y,1,1);
      ctx.fillRect(x,y-1,1,1);
      ctx.fillRect(x,y+1,1,1);
    }
    return;
  }
  if (style === 2){
    for (let i = -r; i <= r; i++){
      ctx.fillRect(x+i, y-r, 1, 1);
      ctx.fillRect(x+i, y+r, 1, 1);
      ctx.fillRect(x-r, y+i, 1, 1);
      ctx.fillRect(x+r, y+i, 1, 1);
    }
    if (main) ctx.fillRect(x,y,1,1);
    return;
  }
  if (style === 3){
    for (let i = 0; i <= r; i++){
      ctx.fillRect(x+i, y-(r-i), 1, 1); ctx.fillRect(x-i, y-(r-i), 1, 1);
      ctx.fillRect(x+i, y+(r-i), 1, 1); ctx.fillRect(x-i, y+(r-i), 1, 1);
    }
    if (main){ ctx.fillStyle = P.wht; ctx.fillRect(x,y,1,1); }
    return;
  }
  if (style === 4){
    const a = r, b = Math.max(2, r - 3);
    for (let i = 0; i <= b; i++){
      ctx.fillRect(x-a+i, y-a, 1, 1); ctx.fillRect(x-a, y-a+i, 1, 1);
      ctx.fillRect(x+a-i, y-a, 1, 1); ctx.fillRect(x+a, y-a+i, 1, 1);
      ctx.fillRect(x-a+i, y+a, 1, 1); ctx.fillRect(x-a, y+a-i, 1, 1);
      ctx.fillRect(x+a-i, y+a, 1, 1); ctx.fillRect(x+a, y+a-i, 1, 1);
    }
    if (main){ ctx.fillStyle = P.wht; ctx.fillRect(x,y,1,1); }
    return;
  }
  if (style === 5){
    for (let i = 3; i <= r + 2; i++){
      ctx.fillRect(x+i, y, 1, 1); ctx.fillRect(x-i, y, 1, 1);
      ctx.fillRect(x, y+i, 1, 1); ctx.fillRect(x, y-i, 1, 1);
    }
    if (main){ ctx.fillStyle = P.wht; ctx.fillRect(x,y,1,1); }
    return;
  }
  if (style === 6 || style === 7){
    const rr = style === 6 ? r : r - 1;
    for (let k = 0; k < 32; k++){
      const a = k / 32 * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr), 1, 1);
    }
    if (style === 6){
      ctx.fillRect(x-rr-3, y, 3, 1); ctx.fillRect(x+rr+1, y, 3, 1);
      ctx.fillRect(x, y-rr-3, 1, 3); ctx.fillRect(x, y+rr+1, 1, 3);
    }
    if (main){ ctx.fillStyle = P.wht; ctx.fillRect(x,y,1,1); }
    return;
  }
  const s=main?5:3;
  const s2=main?Math.round(s+(pulse||1)*0.5):s;
  for(let i=-s2;i<=s2;i++){
    ctx.fillRect(x+i,y+i,1,1);
    ctx.fillRect(x+i,y-i,1,1);
  }
  if(main){
    ctx.fillStyle=P.wht;ctx.fillRect(x,y,1,1);
    ctx.fillStyle=col;
    ctx.fillRect(x-s2-2,y,1,1);ctx.fillRect(x+s2+2,y,1,1);
    ctx.fillRect(x,y-s2-2,1,1);ctx.fillRect(x,y+s2+2,1,1);
  }
}

function formatTime(sec){
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return (m<10?'0':'') + m + ':' + (s<10?'0':'') + s;
}

function drawChainReadout(t){
  if (combo < 2) return;
  const tier = _cachedComboTier || getComboTier(combo);
  const str = tier.name ? (tier.name + ' X' + combo) : ('CHAIN X' + combo);
  const sc = combo >= 3 ? 2 : 1;
  const tw2 = textWN(str, sc);
  const y = SH - 11 - 5 * sc - 6;
  const pa = ctx.globalAlpha;
  ctx.globalAlpha = pa * 0.55; ctx.fillStyle = P.blk;
  ctx.fillRect(Math.round((W - tw2) / 2) - 3, y - 2, tw2 + 6, 5 * sc + 14);
  ctx.globalAlpha = pa;
  drawTextN(str, Math.round((W - tw2) / 2) + 1, y + 1, P.blk, sc);
  drawTextN(str, Math.round((W - tw2) / 2), y, tier.col, sc);
  const barW = Math.min(120, 30 + combo * 6);
  const fillW = Math.round(barW * clamp(comboTimer / comboTimerMax(combo), 0, 1));
  const bx = Math.round((W - barW) / 2), by = y + 5 * sc + 3;
  ctx.fillStyle = P.dblu; ctx.fillRect(bx, by, barW, 2);
  ctx.fillStyle = (comboTimer < 0.5 && Math.sin(t * 20) > 0) ? P.wht : tier.col;
  ctx.fillRect(bx, by, fillW, 2);
}

function drawWaveSummary(t){
  if (!(waveState === 'cleared' || waveState === 'worldclear')) return;
  if (!waveFlow()) return;
  const lines = [];
  if (gameMode === 'rush') lines.push([rush.phase === 'boss' ? ('BOSS ' + (rush.bosses + 1) + ' DOWN') : 'WAVE CLEARED', P.yel]);
  else lines.push([formatWave(wave) + ' CLEARED', P.yel]);
  const standing = installations.filter(i => i.alive).length;
  lines.push(['CITIES  ' + standing + '/' + installations.length, standing === installations.length ? P.lgrn : (standing <= 2 ? P.red : P.org)]);
  lines.push(['ROUND BEST  X' + roundBest, P.lblu]);
  lines.push(['SCORE  ' + String(score).padStart(6, '0'), P.wht]);
  if (waveBonus > 0) lines.push(['BONUS  +' + waveBonus, P.lgrn]);
  const bw = 150, bh = 12 + lines.length * 11, bx = Math.round((W - bw) / 2), by = 52;
  const k = easeOut(clamp((3.4 - Math.min(waveClearTimer, 3.4)) * 4, 0, 1));
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = k * 0.92;
  ctx.fillStyle = P.blk; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = P.red; ctx.fillRect(bx, by, bw, 2); ctx.fillRect(bx, by + bh - 2, bw, 2);
  ctx.fillStyle = P.yel; ctx.fillRect(bx + 4, by + 2, 2, 1);
  ctx.globalAlpha = k;
  for (let i = 0; i < lines.length; i++){
    const [txt, col] = lines[i];
    drawText(txt, Math.round((W - textW(txt)) / 2), by + 8 + i * 11, col);
  }
  ctx.globalAlpha = prevA;
}

function drawHUD(t){
  ctx.fillStyle = P.blk;
  ctx.fillRect(0, 0, W, 24);
  const sScore=String(score).padStart(6,'0');
  drawText2x(sScore, Math.round((W - textW2x(sScore))/2), 1, P.red);
  const wv = gameMode === 'endless';
  if (wv) drawText2x(formatTime(endTime), 2, 1, P.lblu);
  else if (gameMode === 'rush') drawText2x('B' + rush.bosses, 2, 1, P.lblu);
  else drawText2x(formatWave(wave), 2, 1, P.lblu);
  const shownBest = wv ? bestCombo : roundBest;
  const sCh='X'+String(shownBest);
  drawText2x(sCh, W - textW2x(sCh) - 2, 1, P.yel);
  const lab = gameMode === 'rush' ? 'BOSS RUSH' : currentEnv.name;
  drawText(lab, 2, 17, P.gry);
  const lab2 = wv ? 'BEST CHAIN' : 'ROUND BEST';
  drawText(lab2, W - textW(lab2) - 2, 17, P.gry);
  drawText('SCORE', Math.round((W - textW('SCORE'))/2), 17, P.gry);
  if (waveFlow() && totalSpawnCount > 0){
    const barW = W - 4;
    const fillW = Math.round(barW * Math.min(1, totalSpawned / totalSpawnCount));
    ctx.fillStyle = P.dblu;
    ctx.fillRect(2, 23, barW, 1);
    ctx.fillStyle = P.yel;
    ctx.fillRect(2, 23, fillW, 1);
  }
  drawChainReadout(t);
  const pipW=4,gapP=2,total=maxBaseHP*pipW+(maxBaseHP-1)*gapP;
  const bx=Math.round((W-total)/2),by=GROUND-14;
  const lowHP=baseHP<=2;
  const hpPulse=lowHP&&Math.sin(t*6)>0;
  for(let i=0;i<maxBaseHP;i++){
    ctx.fillStyle=i<baseHP?(lowHP?(hpPulse?P.wht:P.red):P.lgrn):currentEnv.ground0;
    ctx.fillRect(bx+i*(pipW+gapP),by,pipW,2);
  }
  const p2=ctx.globalAlpha;
  if(warningT>0){ctx.globalAlpha=warningT*0.35;ctx.fillStyle=P.red;ctx.fillRect(0,0,W,H);ctx.globalAlpha=p2;}
  if(flashT>0){ctx.globalAlpha=flashT*0.25;ctx.fillStyle=P.wht;ctx.fillRect(0,0,W,H);ctx.globalAlpha=p2;}
}

// ---- Menu building blocks --------------------------------------------
const STAR_SPR = ['0001000','0011100','1111111','0111110','0011100','0110110','1100011'];
function drawStar(x, y, col){
  ctx.fillStyle = col;
  for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (STAR_SPR[j][i] === '1') ctx.fillRect(x + i, y + j, 1, 1);
}
function textWN(s, sc){ return s.length * 4 * sc - sc; }
function drawTextN(s, x, y, col, sc){ drawTextS(s, x, y, col, undefined, sc); }
function menuHeader(title){ uiHeader(title); }

// Sunburst behind the planet, built once
let sunburstCanvas = null;
function getSunburst(){
  if (sunburstCanvas) return sunburstCanvas;
  const c = document.createElement('canvas');
  c.width = W; c.height = SH;
  const g = c.getContext('2d');
  const cx = 166, cy = 98, n = 14;
  g.fillStyle = P.dred;
  for (let y = 0; y < SH; y++){
    let runStart = -1, runOn = false;
    for (let x = 0; x <= W; x++){
      let on = false;
      if (x < W){
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > 26 * 26){
          const a = Math.atan2(dy, dx) + Math.PI;
          on = (Math.floor(a / (Math.PI * 2) * n * 2) % 2) === 0;
        }
      }
      if (on && !runOn){ runStart = x; runOn = true; }
      else if (!on && runOn){ g.fillRect(runStart, y, x - runStart, 1); runOn = false; }
    }
  }
  sunburstCanvas = c;
  return c;
}

// Menu attract scene: six outposts under a missile raid and a chain of intercepts
const ATTRACT_CITIES = [{x:12,size:8},{x:68,size:9},{x:98,size:9},{x:158,size:9},{x:188,size:9},{x:244,size:8}];
const ATTRACT_TURRETS = [40, 128, 216];
const attract = { t:0, next:0.6, shotNext:1.2, missiles:[], shots:[], booms:[] };
function attractBaseY(){ return SH - 24; }
function updateAttract(dt){
  attract.t += dt;
  const gy = attractBaseY();
  attract.next -= dt;
  if (attract.next <= 0 && attract.missiles.length < 18){
    attract.next = 2.2 + Math.random() * 1.6;
    const pat = pick(['line','vee','column','diag','block','ring','twin']);
    const pts = formationPoints(pat, rndi(4, 7), rndi(40, W - 40), 6);
    for (const q of pts){
      const tc = pick(ATTRACT_CITIES);
      const vy = rnd(24, 30);
      attract.missiles.push({ x: q.x, y: q.y - 8, x0: q.x, y0: q.y - 8, vx: (tc.x - q.x) / ((gy - q.y) / vy), vy });
    }
  }
  attract.shotNext -= dt;
  if (attract.shotNext <= 0){
    // aim at the point that touches the most missiles
    let best = null, bestN = 0;
    for (const m of attract.missiles){
      if (m.y < 30) continue;
      let n = 0;
      for (const o of attract.missiles) if (Math.hypot(o.x - m.x, o.y - m.y) < 26) n++;
      if (n > bestN){ bestN = n; best = m; }
    }
    if (best){
      attract.shotNext = 0.55 + Math.random() * 0.5;
      const tx = best.x + best.vx * 0.3, ty = best.y + best.vy * 0.3;
      let tur = ATTRACT_TURRETS[0];
      for (const x of ATTRACT_TURRETS) if (Math.abs(x - tx) < Math.abs(tur - tx)) tur = x;
      attract.shots.push({ x0: tur, y0: gy - 17, x1: tx, y1: ty, t: 0, dur: 0.32 });
    } else attract.shotNext = 0.3;
  }
  for (const m of attract.missiles){ m.x += m.vx * dt; m.y += m.vy * dt; }
  for (const sh of attract.shots){
    sh.t += dt;
    if (sh.t >= sh.dur){ sh.done = true; attract.booms.push(new Boom(sh.x1, sh.y1, 'circle', { r: 28, dur: 0.55, noBoss: true })); }
  }
  attract.shots = attract.shots.filter(x => !x.done);
  const fresh = [];
  for (const b of attract.booms){
    b.update(dt);
    if (b.dead || b.p <= 0 || b.p >= 1) continue;
    for (const m of attract.missiles){
      if (m.dead) continue;
      if (b.hitTest(m.x, m.y)){
        m.dead = true;
        const k = Math.random();
        if (k < 0.5) fresh.push(new Boom(m.x, m.y, 'circle', { r: 19, dur: 0.45, noBoss: true }));
        else if (k < 0.7) fresh.push(new Boom(m.x, m.y, 'xcross', { r: 30, dur: 0.55, noBoss: true }));
        else if (k < 0.85) fresh.push(new Boom(m.x, m.y, 'diamond', { r: 17, dur: 0.45, noBoss: true }));
        else fresh.push(new Boom(m.x, m.y, 'ring', { r: 30, dur: 0.6, noBoss: true }));
      }
    }
  }
  for (const m of attract.missiles) if (!m.dead && m.y >= gy - 6){ m.dead = true; fresh.push(new Boom(m.x, gy - 6, 'flash', { r: 9, dur: 0.3, noBoss: true })); }
  for (const f of fresh) attract.booms.push(f);
  attract.missiles = attract.missiles.filter(m => !m.dead);
  attract.booms = attract.booms.filter(b => !b.dead);
  updateParticles(dt);
}
function drawAttract(t, env){
  const gy = attractBaseY();
  const prevEnv = currentEnv;
  currentEnv = env;
  for (const m of attract.missiles){
    drawJaggedTrail(m.x0, m.y0, m.x, m.y, P.dred, 1, 1);
    ctx.fillStyle = P.wht; ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 2);
  }
  for (const c of ATTRACT_CITIES) drawHabitatDome({ x: c.x, size: c.size, alive: true }, t, gy);
  for (const x of ATTRACT_TURRETS){
    const tr = { x, y: gy - 22, flash: 0 };
    const tgt = attract.shots.length ? attract.shots[0] : null;
    const ang = tgt ? Math.atan2(tgt.y1 - tr.y, tgt.x1 - tr.x) : -Math.PI / 2;
    drawTurret(tr, { x: tr.x + Math.cos(ang) * 10, y: tr.y - 2 + Math.sin(ang) * 10 }, null, gy);
  }
  for (const sh of attract.shots){
    const k = clamp(sh.t / sh.dur, 0, 1);
    const cx = sh.x0 + (sh.x1 - sh.x0) * k, cy = sh.y0 + (sh.y1 - sh.y0) * k;
    drawJaggedTrail(sh.x0, sh.y0, cx, cy, P.yel, 1, 1);
    ctx.fillStyle = P.wht; ctx.fillRect(Math.round(cx), Math.round(cy), 2, 1);
  }
  for (const b of attract.booms) b.draw();
  drawParticles();
  currentEnv = prevEnv;
}
// A small satellite on a lazy loop around the planet
// Bosses hover in the cloud band: lay the clouds back over them so they read as inside it
function drawBossMist(t){
  if (boss.state === 'away') return;
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * 0.45 * clamp(1 + (boss.offY || 0) / BOSS_AWAY, 0, 1);
  drawCloudBand(t);
  ctx.globalAlpha = prevA;
}
// A satellite glitters so it can't be mistaken for anything else: a blinking lamp, a pulsing halo
// and sparks trailing behind it
function drawSatelliteFx(e, t){
  const x = Math.round(e.x), y = Math.round(e.y + Math.sin(e.wobble) * 0.5);
  const lamp = Math.sin(t * 18) > 0;
  ctx.fillStyle = lamp ? P.wht : P.rrd; ctx.fillRect(x, y - 4, 1, 1);
  const r = 11 + Math.floor(Math.sin(t * 9) * 1.5);
  ctx.fillStyle = P.yel;
  for (let k = 0; k < 14; k++){
    const a = k / 14 * Math.PI * 2 + t * 2;
    if (k % 2) continue;
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.6), 1, 1);
  }
  if (Math.random() < 0.6) spawnParticle(x - Math.sign(e.vx) * 7, y + rnd(-3, 3), -e.vx * 0.1, rnd(-8, 8), 0.35, pick([P.yel, P.wht, P.org]), 1);
}
// Parachute canopy over a chute missile, striped and gently swaying
function drawCanopy(e, t, alpha){
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * alpha;
  const sway = Math.round(Math.sin(t * 3 + e.wobble) * 1.2);
  const cx = Math.round(e.x) + sway, top = Math.round(e.y) - 10;
  const rows = [[2, 5], [1, 7], [0, 9]];
  for (let r = 0; r < rows.length; r++){
    const [off, w] = rows[r];
    for (let i = 0; i < w; i++){
      ctx.fillStyle = (i + r) % 2 ? P.wht : P.lmag;
      ctx.fillRect(cx - 4 + off + i, top + r, 1, 1);
    }
  }
  ctx.fillStyle = P.gry;
  for (let k = 0; k < 4; k++){
    ctx.fillRect(cx - 4 + Math.round(k * 0.9) + 0, top + 3 + k, 1, 1);
    ctx.fillRect(cx + 4 - Math.round(k * 0.9) - 0, top + 3 + k, 1, 1);
  }
  ctx.globalAlpha = prevA;
}
// Platform shield dome (solid while up, blinks just before it drops) and hit flash
function drawPlatformFx(e, t, spr, alpha){
  const prevA = ctx.globalAlpha;
  ctx.globalAlpha = prevA * alpha;
  if (e.hurt > 0 && Math.sin(t * 50) > 0) drawSprite2600(Object.assign({}, spr, { col: P.wht }), e.x, e.y);
  const warn = e.shT < 0.3 && Math.sin(t * 30) > 0;
  if (e.shieldUp || e.shFlash > 0){
    ctx.fillStyle = e.shFlash > 0 ? P.wht : (warn ? P.lgrn : P.lblu);
    const x = Math.round(e.x), y = Math.round(e.y);
    const [rx, ry] = ETYPES[e.type].shieldR || [12, 8];
    for (let a = 0; a < 6.283; a += 0.16 * 12 / rx){
      ctx.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 1, 1);
    }
  } else if (Math.sin(t * 10) > 0){
    ctx.fillStyle = P.yel;                    // shield down: exposed lights
    ctx.fillRect(Math.round(e.x) - 4, Math.round(e.y) + 2, 1, 1);
    ctx.fillRect(Math.round(e.x) + 4, Math.round(e.y) + 2, 1, 1);
  }
  ctx.globalAlpha = prevA;
}
function drawSputnik(t){
  const th = t * 0.45;
  const x = 166 + Math.cos(th) * 84, y = 92 + Math.sin(th) * 24;
  const front = Math.sin(th) > 0;
  const r = front ? 3 : 2;
  const px = Math.round(x), py = Math.round(y);
  ctx.fillStyle = P.blk;
  fillCircle(px, py, r + 1, P.blk);
  fillCircle(px, py, r, P.wht);
  ctx.fillStyle = P.gry; ctx.fillRect(px - r + 1, py + 1, r * 2 - 1, 1);
  const dir = Math.cos(th) > 0 ? -1 : 1;
  ctx.fillStyle = P.wht;
  for (let k = 1; k <= (front ? 9 : 6); k++){
    ctx.fillRect(px + dir * k, py - Math.round(k * 0.35), 1, 1);
    ctx.fillRect(px + dir * k, py + Math.round(k * 0.35), 1, 1);
  }
  if (Math.sin(t * 7) > 0.2){ ctx.fillStyle = P.rrd; ctx.fillRect(px, py, 1, 1); }
}
