// ══════════════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════════════
let pickedFactions = { a: null, b: null };
let factionPickStep = 'a';
let activeMapTab = 'p0';
let edCols=10, edRows=10, edTerrain=[], edTool='empty';

let COLS=10, ROWS=10, tmap={};
let units=[], sel=null, phase='move', turn='a';
let hlM=[], hlA=[], logs=[];
let combat=null;

// ── helpers ──
const tk=(c,r)=>`${c},${r}`;
const gT=(c,r)=>tmap[tk(c,r)]||0;
const blocking=(c,r)=>{const t=gT(c,r);return t===1||t===3;};
const dist=(a,b)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row);
const alive=u=>u.hp>0;
const uAt=(c,r)=>units.find(u=>u.col===c&&u.row===r&&alive(u));
const roll=n=>Array.from({length:n},()=>Math.floor(Math.random()*6)+1);
const addLog=(msg,cls='sys')=>{logs.unshift({msg,cls});if(logs.length>60)logs.pop();};

function mkUnit(rosterEntry, team, id, col, row, factionKey){
  const r=rosterEntry;
  const fac=FACTIONS[factionKey];
  const moveBonus = factionKey==='orks' ? 1 : 0;
  return{
    id, factionKey, team, col, row,
    name:r.name, e:r.e,
    hp:r.hp, maxHp:r.hp,
    move:r.move+moveBonus, atk:r.atk, ar:r.ar, def:r.def, dmg:r.dmg,
    orkAtk:!!r.orkAtk, reanimation:!!r.reanimation,
    moved:false, attacked:false, reanimated:false,
    facColor:fac.color, facBg:fac.bg,
  };
}

function loadGame(mapDef){
  COLS=mapDef.cols; ROWS=mapDef.rows; tmap={};
  (mapDef.terrain||[]).forEach(({c,r,t})=>{tmap[tk(c,r)]=t;});
  units=[];
  let uid=1;
  const facA=FACTIONS[pickedFactions.a];
  const facB=FACTIONS[pickedFactions.b];
  const startsA=mapDef.starts?.a||[[0,0],[1,1],[0,2],[2,0]];
  const startsB=mapDef.starts?.b||[[COLS-1,ROWS-1],[COLS-2,ROWS-2],[COLS-1,ROWS-3],[COLS-3,ROWS-1]];
  facA.roster.forEach((r,i)=>{
    if(startsA[i]) units.push(mkUnit(r,'a',uid++,startsA[i][0],startsA[i][1],pickedFactions.a));
  });
  facB.roster.forEach((r,i)=>{
    if(startsB[i]) units.push(mkUnit(r,'b',uid++,startsB[i][0],startsB[i][1],pickedFactions.b));
  });
  sel=null; phase='move'; turn='a'; hlM=[]; hlA=[]; logs=[]; combat=null;
  const fa=FACTIONS[pickedFactions.a], fb=FACTIONS[pickedFactions.b];
  addLog(`${fa.icon} ${fa.name} vs ${fb.icon} ${fb.name}`,'sys');
  addLog(`--- ${fa.icon} ${fa.name} beginnt ---`,'sys');
}

// ── movement & attack ──
function moveRange(u){
  const out=[];
  for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++)
    if(dist(u,{col:c,row:r})<=u.move && !uAt(c,r) && !blocking(c,r)) out.push([c,r]);
  return out;
}
function atkCells(u){
  const out=[];
  for(let c=0;c<COLS;c++) for(let r=0;r<ROWS;r++)
    if((c!==u.col||r!==u.row) && dist(u,{col:c,row:r})<=u.ar) out.push([c,r]);
  return out;
}
function targets(u){ return units.filter(e=>e.team!==u.team&&alive(e)&&dist(u,e)<=u.ar); }

// ── COVER SYSTEM ──
function coverBonus(defender){
  if(gT(defender.col,defender.row)!==2) return 0;
  return defender.factionKey==='marines' ? 2 : 1;
}

// ── COMBAT ──
function startCombat(att,def){
  const cov=coverBonus(def);
  combat={att,def,step:'roll_atk',ar:null,dr:null,coverBonus:cov};
  const covStr=cov>0?` (Ziel in Deckung: +${cov} Rüstungswürfel)`:'';
  addLog(`⚔️ ${att.e} ${att.name} greift ${def.e} ${def.name} an!${covStr}`,'hit');
  if(cov>0) addLog(`🌿 Deckungsbonus: ${def.name} würfelt ${def.def+cov} Rüstungswürfel`,'cov');
}

function rollAtk(){
  combat.ar=roll(combat.att.atk);
  combat.step='roll_def';
  addLog(`${combat.att.e} Angriff [${combat.ar.join(',')}]`,'hit');
  renderGame();
}

function rollDef(){
  const{att,def,ar,coverBonus:cov}=combat;
  const totalDef=def.def+cov;
  combat.dr=roll(totalDef);
  const hitThresh=att.orkAtk?3:4;
  const hits=ar.filter(v=>v>=hitThresh).length;
  const saves=combat.dr.filter(v=>v>=5).length;
  const wounds=Math.max(0,hits-saves);
  const[mn,mx]=att.dmg;
  const dmg=wounds*(mn+Math.floor(Math.random()*(mx-mn+1)));
  def.hp=Math.max(0,def.hp-dmg);
  att.attacked=true;
  addLog(`${def.e} Rüstung [${combat.dr.join(',')}]${cov>0?` (+${cov} Deckung)`:''}`,'mov');
  if(dmg===0) addLog(`🛡️ Abgewehrt! ${hits} Treffer, ${saves} Rettungen → 0 Schaden`,'mis');
  else addLog(`💥 ${wounds} Wunden → ${dmg} Schaden! ${def.name} HP: ${def.hp}/${def.maxHp}`,'hit');

  // Necron reanimation
  if(def.hp<=0){
    if(def.reanimation&&!def.reanimated){
      const rr=roll(1)[0];
      addLog(`⚙️ Reanimationsprotokoll: ${def.e} würfelt ${rr}…`,'cov');
      if(rr>=5){
        def.hp=3; def.reanimated=true;
        addLog(`✅ ${def.name} steht wieder auf! (3 HP)`,'cov');
      } else {
        addLog(`❌ Reanimation fehlgeschlagen — ${def.name} vernichtet!`,'kil');
      }
    } else {
      addLog(`☠️ ${def.e} ${def.name} vernichtet!`,'kil');
    }
  }
  combat=null;
  checkWin();
  renderGame();
}

function checkWin(){
  const a=units.filter(u=>u.team==='a'&&alive(u)).length;
  const b=units.filter(u=>u.team==='b'&&alive(u)).length;
  const fa=FACTIONS[pickedFactions.a], fb=FACTIONS[pickedFactions.b];
  if(a===0){ addLog(`${fb.icon} ${fb.name} gewinnen!`,'kil'); phase='over'; }
  if(b===0){ addLog(`${fa.icon} ${fa.name} gewinnen!`,'kil'); phase='over'; }
}

// endTurn — im Online-Modus sendet sendMove() den Zug (definiert in multiplayer.js)
async function endTurn(){
  turn=turn==='a'?'b':'a';
  units.forEach(u=>{u.moved=false; u.attacked=false;});
  sel=null; hlM=[]; hlA=[]; phase='move'; combat=null;
  const fac=FACTIONS[pickedFactions[turn]];
  addLog(`--- ${fac.icon} ${fac.name} am Zug ---`,'sys');
  renderGame();

  // Nur im Online-Modus senden — sendMove() kommt aus multiplayer.js
  if(multiplayerMode && typeof sendMove === 'function'){
    await sendMove();
  }
}

function selUnit(u){
  if(u.team!==turn||!alive(u)) return;
  sel=u; combat=null;
  hlM=phase==='move'?moveRange(u):[];
  hlA=phase==='attack'?atkCells(u):[];
  renderGame();
}

function clickCell(c,r){
  if(phase==='over') return;
  if(combat&&combat.step!=='roll_atk') return;
  const occ=uAt(c,r);
  if(occ&&occ.team===turn&&alive(occ)){ selUnit(occ); return; }
  if(sel){
    if(phase==='move'&&!sel.moved){
      if(hlM.some(([hc,hr])=>hc===c&&hr===r)){
        sel.col=c; sel.row=r; sel.moved=true; hlM=[];
        addLog(`${sel.e} ${sel.name} → (${c},${r})`,'mov');
        renderGame(); return;
      }
    }
    if(phase==='attack'&&!sel.attacked){
      const tgt=uAt(c,r);
      if(tgt&&tgt.team!==turn&&dist(sel,tgt)<=sel.ar){
        startCombat(sel,tgt); hlA=[]; renderGame(); return;
      }
    }
  }
  sel=null; hlM=[]; hlA=[]; combat=null; renderGame();
}