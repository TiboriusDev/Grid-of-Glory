// ══════════════════════════════════════════════════════
// RENDER GAME
// ══════════════════════════════════════════════════════
function renderBoard(){
  const wrap=document.getElementById('board-wrap');
  wrap.innerHTML='';
  const grid=document.createElement('div');
  grid.className='board-grid';
  grid.style.gridTemplateColumns=`repeat(${COLS},40px)`;
  grid.style.gridTemplateRows=`repeat(${ROWS},40px)`;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      const cell=document.createElement('div');
      const ter=gT(c,r);
      let cls='cell '+((c+r)%2===0?'c-light':'c-dark');
      if(ter===1) cls+=' t-wall';
      else if(ter===2) cls+=' t-cover';
      else if(ter===3) cls+=' t-water';
      if(hlM.some(([hc,hr])=>hc===c&&hr===r)) cls+=' hl-move';
      if(hlA.some(([hc,hr])=>hc===c&&hr===r)) cls+=' hl-atk';
      cell.className=cls;
      if(ter===1) cell.textContent='🧱';
      else if(ter===3) cell.textContent='🌊';
      const u=uAt(c,r);
      if(u){
        if(sel&&sel.id===u.id) cell.classList.add('hl-sel');
        const ud=document.createElement('div');
        ud.className=`unit${(u.moved&&u.attacked)?' spent':''}`;
        ud.style.background=u.facBg;
        ud.style.borderColor=u.facColor;
        ud.textContent=u.e;
        ud.title=`${u.name} HP:${u.hp}/${u.maxHp}`;
        const hb=document.createElement('div'); hb.className='hp-bar';
        const hf=document.createElement('div'); hf.className='hp-fill';
        hf.style.width=Math.max(0,u.hp/u.maxHp*100)+'%';
        hb.appendChild(hf); ud.appendChild(hb); cell.appendChild(ud);
      }
      const cc=c, rr=r;
      cell.addEventListener('click',()=>clickCell(cc,rr));
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
}

function renderSidebar(){
  // phase bar
  const pb=document.getElementById('phase-bar');
  pb.innerHTML='';
  [{k:'move',l:'1· Bewegen'},{k:'attack',l:'2· Angreifen'}].forEach(({k,l})=>{
    const b=document.createElement('button');
    b.className='pb'+(phase===k?' active':'');
    b.textContent=l; b.disabled=phase==='over';
    b.addEventListener('click',()=>{
      if(phase==='over') return;
      phase=k; sel=null; hlM=[]; hlA=[]; combat=null; renderGame();
    });
    pb.appendChild(b);
  });

  // turn label — zeigt auch ob man dran ist im Online-Modus
  const tl=document.getElementById('turn-label');
  if(phase==='over'){
    tl.innerHTML='<span style="color:#E24B4A;font-size:13px;">Spiel vorbei!</span>';
  } else {
    const fac=FACTIONS[pickedFactions[turn]];
    const myTurn=!multiplayerMode||(turn===myTeam);
    const turnSuffix=multiplayerMode?(myTurn?' — Du bist dran':' — Gegner am Zug'):'';
    tl.innerHTML=`<span style="color:${fac.color}">${fac.icon} ${fac.name} am Zug${turnSuffix}</span>`;
  }

  // unit card
  const uc=document.getElementById('unit-card');
  if(sel){
    const fac=FACTIONS[sel.factionKey];
    const cov=coverBonus(sel);
    const covStr=cov>0?`<span class="cov-badge">+${cov} Deckung</span>`:'';
    const orkStr=sel.orkAtk?'<span style="font-size:10px;color:#3B6D11"> (Treffer: 3+)</span>':'';
    const reanStr=sel.reanimation?'<div class="sr-row"><span>Reanimation</span><span style="color:#0F6E56">5+ kehrt zurück</span></div>':'';
    uc.innerHTML=`<h3>${sel.e} ${sel.name} <span style="font-size:10px;color:${fac.color}">${fac.icon} ${fac.name}</span></h3>
    <div class="sr-row"><span>HP</span><span>${sel.hp} / ${sel.maxHp}</span></div>
    <div class="sr-row"><span>Bewegung</span><span style="color:#185FA5">${sel.move} Felder</span></div>
    <div class="sr-row"><span>Angriffsreichweite</span><span style="color:#993C1D">${sel.ar} Felder</span></div>
    <div class="sr-row"><span>Angriffswürfel</span><span>${sel.atk}W6${orkStr}</span></div>
    <div class="sr-row"><span>Rüstungswürfel</span><span>${sel.def}W6 ${covStr}</span></div>
    <div class="sr-row"><span>Schaden/Wunde</span><span>${sel.dmg[0]}–${sel.dmg[1]}</span></div>
    ${reanStr}
    <div class="sr-row"><span>Bewegt</span><span>${sel.moved?'✅':'—'}</span></div>
    <div class="sr-row"><span>Angegriffen</span><span>${sel.attacked?'✅':'—'}</span></div>`;
  } else {
    uc.innerHTML='<h3>Keine Einheit gewählt</h3><div style="font-size:11px;color:var(--text-secondary)">Einheit anklicken</div>';
  }

  // actions — im Online-Modus nur wenn man dran ist
  const ac=document.getElementById('actions');
  ac.innerHTML='';

  if(phase==='over'){
    mkBtn(ac,'🔄 Neu starten',()=>{ showLobby(); });
    renderLog(); return;
  }

  // Online: Aktionen sperren wenn Gegner dran ist
  if(multiplayerMode && turn !== myTeam){
    const lbl=document.createElement('div');
    lbl.style.cssText='font-size:12px;color:var(--text-secondary);padding:8px 0;';
    lbl.textContent='⏳ Warte auf Gegner…';
    ac.appendChild(lbl);
    mkBtn(ac,'⏭️ Zug beenden — gesperrt',()=>{});
    ac.lastChild.disabled=true;
    renderLog(); return;
  }

  if(combat){
    const{att,def,step,ar,coverBonus:cov}=combat;
    const dp=document.createElement('div'); dp.className='dice-panel';
    const hitThresh=att.orkAtk?3:4;
    if(step==='roll_atk'){
      dp.innerHTML=`<div class="dice-title">⚔️ <b>${att.e} ${att.name}</b> → <b>${def.e} ${def.name}</b></div>
      <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">Würfle <b>${att.atk} Würfel</b> — Treffer bei <b>${hitThresh}+</b></div>`;
      const b=document.createElement('button'); b.className='act-btn roll-a';
      b.textContent=`🎲 ${att.atk}W6 Angriff würfeln (Treffer: ${hitThresh}+)`;
      b.addEventListener('click',rollAtk); dp.appendChild(b);
    } else if(step==='roll_def'){
      const totalDef=def.def+cov;
      const hits=ar.filter(v=>v>=hitThresh).length;
      const row=document.createElement('div'); row.className='dice-row';
      ar.forEach(v=>{
        const d=document.createElement('div');
        d.className='die '+(v>=hitThresh?'ok':'no');
        d.textContent=v; row.appendChild(d);
      });
      dp.innerHTML=`<div class="dice-title">🎯 Angriff — <b>${hits} Treffer</b> (grün = ${hitThresh}+)</div>`;
      dp.appendChild(row);
      const hint=document.createElement('div');
      hint.style.cssText='font-size:11px;color:var(--text-secondary);margin:4px 0 6px;line-height:1.4;';
      hint.innerHTML=`Rüstung würfeln — <b>${totalDef} Würfel</b>${cov>0?` <span class="cov-badge">+${cov} Deckung</span>`:''}, Rettung bei <b>5+</b>`;
      dp.appendChild(hint);
      const b=document.createElement('button'); b.className='act-btn roll-d';
      b.textContent=`🛡️ ${totalDef}W6 Rüstung würfeln (Rettung: 5+)`;
      b.addEventListener('click',rollDef); dp.appendChild(b);
    }
    ac.appendChild(dp);
    mkBtn(ac,'✗ Abbrechen',()=>{ combat=null; renderGame(); });
    renderLog(); return;
  }

  if(sel&&phase==='move'&&!sel.moved)
    mkBtn(ac,`Bewegungsfelder anzeigen (${sel.move} Felder)`,()=>{ hlM=moveRange(sel); renderGame(); });

  if(sel&&phase==='attack'&&!sel.attacked){
    mkBtn(ac,`Angriffsfelder anzeigen (${sel.ar} Felder)`,()=>{ hlA=atkCells(sel); renderGame(); });
    const ts=targets(sel);
    if(ts.length){
      const lbl=document.createElement('div');
      lbl.style.cssText='font-size:10px;color:var(--text-muted);margin:4px 0 2px;';
      lbl.textContent='Ziele in Reichweite:'; ac.appendChild(lbl);
      ts.forEach(e=>{
        const cov=coverBonus(e);
        const b=document.createElement('button'); b.className='act-btn atk';
        b.innerHTML=`⚔️ ${e.e} ${e.name} — ${dist(sel,e)} Felder (HP ${e.hp}/${e.maxHp})${cov>0?` <span class="cov-badge">Deckung+${cov}</span>`:''}`;
        b.addEventListener('click',()=>{ startCombat(sel,e); hlA=[]; renderGame(); });
        ac.appendChild(b);
      });
    } else {
      const lbl=document.createElement('div');
      lbl.style.cssText='font-size:11px;color:var(--text-muted);margin-top:4px;';
      lbl.textContent='Kein Ziel in Reichweite'; ac.appendChild(lbl);
    }
  }
  mkBtn(ac,'⏭️ Zug beenden', endTurn);
  renderLog();
}

function mkBtn(parent,label,cb){
  const b=document.createElement('button'); b.className='act-btn'; b.innerHTML=label;
  b.addEventListener('click',cb); parent.appendChild(b);
}
function renderLog(){
  const el=document.getElementById('log-box');
  if(el) el.innerHTML=logs.map(l=>`<div class="le ${l.cls}">${l.msg}</div>`).join('');
}
function renderLegend(){
  const el=document.getElementById('game-legend');
  if(!el||!pickedFactions.a||!pickedFactions.b) return;
  const fa=FACTIONS[pickedFactions.a], fb=FACTIONS[pickedFactions.b];
  el.innerHTML=`
    <div class="leg"><div class="leg-sq" style="background:${fa.bg};border-color:${fa.color}"></div>${fa.icon} ${fa.name}</div>
    <div class="leg"><div class="leg-sq" style="background:${fb.bg};border-color:${fb.color}"></div>${fb.icon} ${fb.name}</div>
    <div class="leg"><div class="leg-sq" style="background:#c8dff7;border-color:#185FA5"></div>Bewegung</div>
    <div class="leg"><div class="leg-sq" style="background:#f5c4b3;border-color:#993C1D"></div>Angriff</div>
    <div class="leg"><div class="leg-sq" style="background:#9FE1CB"></div>Deckung</div>
    <div class="leg"><div class="leg-sq" style="background:#85B7EB"></div>Wasser</div>`;
}
function renderGame(){
  renderBoard();
  renderSidebar();
  renderLegend();
}

// ══════════════════════════════════════════════════════
// FACTION SCREEN (Offline)
// ══════════════════════════════════════════════════════
function showFaction(){
  hideAllScreens();
  document.getElementById('screen-faction').style.display='';
  document.getElementById('faction-offline-container').style.display='';
  document.getElementById('faction-online-container').style.display='none';
  factionPickStep='a';
  pickedFactions={a:null,b:null};
  renderFactionScreen();
}

function renderFactionScreen(){
  const lbl=document.getElementById('faction-pick-label');
  lbl.innerHTML=factionPickStep==='a'
    ?'<span style="color:#185FA5">🔵 Spieler 1 wählt sein Volk:</span>'
    :`<span style="color:#185FA5">🔵 Spieler 1: <b>${FACTIONS[pickedFactions.a].icon} ${FACTIONS[pickedFactions.a].name}</b></span><br>
      <span style="color:#993C1D">🔴 Spieler 2 wählt sein Volk:</span>`;

  const grid=document.getElementById('faction-grid');
  grid.innerHTML='';
  Object.entries(FACTIONS).forEach(([key,fac])=>{
    const card=document.createElement('div');
    card.className='faction-card';
    const currentPick=factionPickStep==='a'?pickedFactions.a:pickedFactions.b;
    if(currentPick===key) card.classList.add('selected');
    const disabled=factionPickStep==='b'&&pickedFactions.a===key;
    card.style.opacity=disabled?'0.35':'1';
    card.style.cursor=disabled?'not-allowed':'pointer';
    card.innerHTML=`<div class="faction-name">${fac.icon} ${fac.name}</div>
    <div class="faction-desc">${fac.desc}</div>
    <div class="faction-trait" style="background:${fac.traitBg};color:${fac.traitColor}">⚡ ${fac.trait}: ${fac.traitDesc}</div>
    <div class="roster-list">${fac.roster.map(r=>`${r.e} ${r.name} (BW:${r.move} AW:${r.ar} HP:${r.hp})`).join('<br>')}</div>`;
    if(!disabled){
      card.addEventListener('click',()=>{
        if(factionPickStep==='a') pickedFactions.a=key;
        else pickedFactions.b=key;
        renderFactionScreen();
        updateFactionBtn();
      });
    }
    grid.appendChild(card);
  });
  updateFactionBtn();
}

function updateFactionBtn(){
  const btn=document.getElementById('btn-faction-next');
  const hasPick=factionPickStep==='a'?!!pickedFactions.a:!!pickedFactions.b;
  btn.disabled=!hasPick;
  if(factionPickStep==='a') btn.textContent='Weiter — Spieler 2 wählt →';
  else btn.textContent='Weiter — Karte wählen →';
}

document.getElementById('btn-faction-next').addEventListener('click',()=>{
  // Guard: Online-Modus wird von multiplayer.js behandelt
  if(multiplayerMode) return;
  if(factionPickStep==='a'){
    factionPickStep='b';
    renderFactionScreen();
  } else if(pickedFactions.b){
    showMap();
  }
});

// ══════════════════════════════════════════════════════
// MAP SCREEN
// ══════════════════════════════════════════════════════
function showMap(){
  hideAllScreens();
  document.getElementById('screen-map').style.display='';
  renderMapScreen();
}

function renderMapScreen(){
  const tabs=document.getElementById('map-tabs');
  const content=document.getElementById('map-content');
  tabs.innerHTML='';
  [{k:'p0',l:'Offenes Feld'},{k:'p1',l:'Ruinen'},{k:'p2',l:'Fluss'},{k:'ed',l:'✏️ Editor'}].forEach(({k,l})=>{
    const b=document.createElement('button');
    b.className='map-tab'+(activeMapTab===k?' active':'');
    b.textContent=l;
    b.addEventListener('click',()=>{ activeMapTab=k; renderMapScreen(); });
    tabs.appendChild(b);
  });
  content.innerHTML='';
  if(activeMapTab.startsWith('p')){
    const m=MAPS[parseInt(activeMapTab[1])];
    const info=document.createElement('div');
    info.style.cssText='font-size:11px;color:var(--text-secondary);margin-bottom:8px;';
    info.textContent=`${m.cols}×${m.rows} Felder · ${(m.terrain||[]).length} Geländefelder`;
    content.appendChild(info);
    content.appendChild(buildMini(m));
  } else {
    renderEditor(content);
  }
}

function buildMini(m){
  const etm={};(m.terrain||[]).forEach(({c,r,t})=>{ etm[`${c},${r}`]=t; });
  const um={};
  m.starts.a.forEach(pos=>{ um[`${pos[0]},${pos[1]}`]={team:'a'}; });
  m.starts.b.forEach(pos=>{ um[`${pos[0]},${pos[1]}`]={team:'b'}; });
  const cz=Math.min(28,Math.floor(430/m.cols));
  const grid=document.createElement('div');
  grid.style.cssText=`display:inline-grid;grid-template-columns:repeat(${m.cols},${cz}px);grid-template-rows:repeat(${m.rows},${cz}px);border:1px solid var(--border-strong);`;
  for(let r=0;r<m.rows;r++) for(let c=0;c<m.cols;c++){
    const cell=document.createElement('div');
    const ter=etm[`${c},${r}`]||0;
    let bg=(c+r)%2===0?'#f0ede8':'#e4e1da';
    if(ter===1) bg='#555'; else if(ter===2) bg='#9FE1CB'; else if(ter===3) bg='#85B7EB';
    cell.style.cssText=`width:${cz}px;height:${cz}px;display:flex;align-items:center;justify-content:center;border:0.5px solid var(--border);font-size:${Math.max(8,cz-10)}px;background:${bg};`;
    const u=um[`${c},${r}`];
    if(u) cell.textContent=u.team==='a'?'🔵':'🔴';
    else if(ter===1) cell.textContent='🧱';
    else if(ter===3) cell.textContent='🌊';
    grid.appendChild(cell);
  }
  return grid;
}

function renderEditor(content){
  const srow=document.createElement('div');
  srow.style.cssText='display:flex;align-items:center;gap:8px;font-size:11px;margin-bottom:8px;flex-wrap:wrap;';
  srow.innerHTML=`<span>Breite:</span><input class="size-inp" type="number" id="ed-cols" min="6" max="16" value="${edCols}">
  <span>Höhe:</span><input class="size-inp" type="number" id="ed-rows" min="6" max="16" value="${edRows}">`;
  const applyBtn=document.createElement('button'); applyBtn.className='pb'; applyBtn.textContent='Anwenden';
  applyBtn.addEventListener('click',()=>{
    edCols=Math.min(16,Math.max(6,parseInt(document.getElementById('ed-cols').value)||10));
    edRows=Math.min(16,Math.max(6,parseInt(document.getElementById('ed-rows').value)||10));
    edTerrain=edTerrain.filter(e=>e.c<edCols&&e.r<edRows);
    renderMapScreen();
  });
  srow.appendChild(applyBtn); content.appendChild(srow);

  const tbar=document.createElement('div'); tbar.style.cssText='display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;';
  [{k:'empty',l:'Leer'},{k:'wall',l:'🧱 Mauer'},{k:'cover',l:'🌿 Deckung'},{k:'water',l:'🌊 Wasser'}].forEach(({k,l})=>{
    const b=document.createElement('button'); b.className='tool-btn'+(edTool===k?' active':'');
    b.textContent=l; b.addEventListener('click',()=>{ edTool=k; renderMapScreen(); });
    tbar.appendChild(b);
  });
  const clr=document.createElement('button'); clr.className='tool-btn'; clr.textContent='Alles löschen';
  clr.addEventListener('click',()=>{ edTerrain=[]; renderMapScreen(); });
  tbar.appendChild(clr); content.appendChild(tbar);

  const etm={}; edTerrain.forEach(({c,r,t})=>{ etm[`${c},${r}`]=t; });
  const cz=Math.min(30,Math.floor(430/edCols));
  const grid=document.createElement('div');
  grid.style.cssText=`display:inline-grid;grid-template-columns:repeat(${edCols},${cz}px);grid-template-rows:repeat(${edRows},${cz}px);border:1px solid var(--border-strong);cursor:crosshair;margin-bottom:6px;`;
  for(let r=0;r<edRows;r++) for(let c=0;c<edCols;c++){
    const cell=document.createElement('div');
    const ter=etm[`${c},${r}`]||0;
    let bg=(c+r)%2===0?'#f0ede8':'#e4e1da';
    if(ter===1) bg='#555'; else if(ter===2) bg='#9FE1CB'; else if(ter===3) bg='#85B7EB';
    cell.style.cssText=`width:${cz}px;height:${cz}px;display:flex;align-items:center;justify-content:center;border:0.5px solid var(--border);font-size:${Math.max(8,cz-8)}px;background:${bg};`;
    if(ter===1) cell.textContent='🧱'; else if(ter===3) cell.textContent='🌊';
    const cc=c, rr=r;
    cell.addEventListener('click',()=>{
      const tv={empty:0,wall:1,cover:2,water:3}[edTool];
      edTerrain=edTerrain.filter(e=>!(e.c===cc&&e.r===rr));
      if(tv>0) edTerrain.push({c:cc,r:rr,t:tv});
      renderMapScreen();
    });
    grid.appendChild(cell);
  }
  content.appendChild(grid);

  const hint=document.createElement('div'); hint.style.cssText='font-size:10px;color:var(--text-muted);';
  hint.textContent='Felder anklicken um Gelände zu setzen. Einheiten werden automatisch platziert.';
  content.appendChild(hint);
}

// btn-map-start: Guard für Online-Modus (Online wird von multiplayer.js behandelt)
// document.getElementById('btn-map-start').addEventListener('click',()=>{
//   if(multiplayerMode) return; // Online: multiplayer.js übernimmt

//   let mapDef;
//   if(activeMapTab.startsWith('p')){
//     mapDef=MAPS[parseInt(activeMapTab[1])];
//   } else {
//     const etm={}; edTerrain.forEach(({c,r,t})=>{ etm[`${c},${r}`]=t; });
//     const free=[];
//     for(let r=0;r<edRows;r++) for(let c=0;c<edCols;c++)
//       if(!(etm[`${c},${r}`]>0)) free.push([c,r]);
//     const aSlots=free.filter(([c])=>c<Math.floor(edCols/3)).slice(0,4);
//     const bSlots=free.filter(([c])=>c>=Math.ceil(edCols*2/3)).slice(0,4);
//     mapDef={name:'Eigene Karte',cols:edCols,rows:edRows,terrain:edTerrain,
//       starts:{a:aSlots,b:bSlots}};
//   }
//   loadGame(mapDef);
//   hideAllScreens();
//   document.getElementById('screen-game').style.display='';
//   renderGame();
// });

// btn-back: zurück zur Lobby (nicht mehr zu showFaction)
document.getElementById('btn-back').addEventListener('click',()=>{
  showLobby(); // showLobby kommt aus multiplayer.js und räumt den Online-State auf
});