// ══════════════════════════════════════════════════════
// GAME STATE
// ══════════════════════════════════════════════════════
let pickedFactions = { a: null, b: null };
let factionPickStep = 'a';
let activeMapTab = 'p0';
let edCols=10, edRows=10, edTerrain=[], edTool='empty';

let COLS=10, ROWS=10, tmap={}, tobj={};
let units=[], sel=null, phase='move', turn='a';
let hlM=[], hlA=[], logs=[];
let combat=null;

// Deployment Phase
let deploymentMode = false;
let deploymentZoneRows = 3; // erste 3 Reihen
let deploymentConfirmed = { a: false, b: false };
let deploymentDragUnit = null;

// ── helpers ──
const tk=(c,r)=>`${c},${r}`;
const gT=(c,r)=>tmap[tk(c,r)]||0;  // Base Terrain
const gO=(c,r)=>tobj[tk(c,r)]||0;  // Terrain Object
const blocking=(c,r)=>{const o=gO(c,r);return o===1||o===2;};  // Wall, Cover blockieren
const dist=(a,b)=>Math.abs(a.col-b.col)+Math.abs(a.row-b.row);
const alive=u=>u.hp>0;
const uAt=(c,r)=>units.find(u=>u.col===c&&u.row===r&&alive(u));
const inDeploymentZone=(u)=>{
  if(u.team==='a') return u.row < deploymentZoneRows;
  else return u.row >= ROWS - deploymentZoneRows;
};
const roll=n=>Array.from({length:n},()=>Math.floor(Math.random()*6)+1);
const addLog=(msg,cls='sys')=>{logs.unshift({msg,cls});if(logs.length>60)logs.pop();};

function mkUnit(rosterEntry, team, id, col, row, factionKey){
  const r=rosterEntry;
  const fac=FACTIONS[factionKey];
  const moveBonus = factionKey==='orks' ? 1 : 0;
  
  // Sprite-Key basierend auf Einheits-Namen oder Emoji
  let spriteKey = 'warrior';
  const name = r.name.toLowerCase();
  if(name.includes('zauberer') || name.includes('wizard')) spriteKey = 'wizard';
  else if(name.includes('bogen') || name.includes('archer')) spriteKey = 'archer';
  else if(name.includes('ritter') || name.includes('knight')) spriteKey = 'knight';
  else if(name.includes('kleriker') || name.includes('cleric')) spriteKey = 'cleric';
  else if(name.includes('ork') && name.includes('krieger')) spriteKey = 'orc_warrior';
  else if(name.includes('schamane')) spriteKey = 'orc_shaman';
  else if(name.includes('goblin')) spriteKey = 'goblin';
  else if(name.includes('troll')) spriteKey = 'troll';
  else if(name.includes('skelett') || name.includes('skeleton')) spriteKey = 'skeleton';
  else if(name.includes('zombie')) spriteKey = 'zombie';
  else if(name.includes('geist') || name.includes('ghost')) spriteKey = 'ghost';
  else if(name.includes('lich')) spriteKey = 'lich';
  
  return{
    id, factionKey, team, col, row,
    name:r.name, e:r.e, spriteKey,
    hp:r.hp, maxHp:r.hp,
    move:r.move+moveBonus, atk:r.atk, ar:r.ar, def:r.def, dmg:r.dmg,
    orkAtk:!!r.orkAtk, reanimation:!!r.reanimation,
    moved:false, attacked:false, reanimated:false,
    facColor:fac.color, facBg:fac.bg,
  };
}

function loadGame(mapDef){
  COLS=mapDef.cols; ROWS=mapDef.rows; tmap={}; tobj={};
  
  // Terrain-Konvertierung: Alte IDs zu (base, obj)
  const terrainMap = {
    0: [0, 0],  // Gras, nichts
    1: [0, 1],  // Gras, Wand
    2: [0, 2],  // Gras, Deckung
    3: [1, 0],  // Wasser, nichts
  };
  
  // Lade Gelände aus Map-Definition
  (mapDef.terrain||[]).forEach(({c,r,t})=>{
    const [base, obj] = terrainMap[t] || [0, 0];
    tmap[tk(c,r)] = base;
    if(obj > 0) tobj[tk(c,r)] = obj;
  });
  
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
  // 🔒 SICHERHEIT: Würfel werden vom SERVER geworfen!
  // Diese Funktion wird jetzt async gemacht in multiplayer.js
  combat.ar=roll(combat.att.atk);
  combat.step='roll_def';
  addLog(`${combat.att.e} Angriff [${combat.ar.join(',')}]`,'hit');
  renderGame();
  if(typeof sendMove==='function') sendMove(); // Sync sofort nach Angriffswurf
}

/**
 * 🔒 SICHERE Version von rollAtk mit Server-Würfeln
 * Wird von multiplayer.js aufgerufen
 */
async function rollAtkSecure(){
  try {
    if (!currentRoom) {
      addLog('❌ Keine aktive Spielsitzung','err');
      console.error('rollAtkSecure: currentRoom ist undefined', currentRoom);
      return false;
    }

    if (!combat) {
      addLog('❌ Kein Combat aktiv','err');
      console.error('rollAtkSecure: combat ist undefined', combat);
      return false;
    }

    const diceCount = combat.att.atk;
    const payload = {
      game_id: currentGameId,
      move_id: combat.moveId || 'temp_' + Date.now(), // Temp ID bis Move gespeichert
      roll_type: 'attack',
      dice_count: diceCount
    };
    
    console.log('🎲 rollAtkSecure - Payload:', payload);
    
    // 🔒 SERVER WÜRFELT!
    const diceResult = await callEdgeFunction('roll-dice', payload);

    console.log('🎲 rollAtkSecure - Ergebnis:', diceResult);

    // Echte Würfel vom Server verwenden!
    combat.ar = diceResult.rolls;
    combat.step = 'roll_def';
    
    addLog(`${combat.att.e} Angriff [${combat.ar.join(',')}]`,'hit');
    renderGame();
    
    if(typeof sendMove === 'function') sendMove();
    return true;

  } catch (error) {
    addLog(`❌ Würfel-Fehler: ${error.message}`,'err');
    console.error('rollAtkSecure Error:', error);
    return false;
  }
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
  if(typeof sendMove==='function') sendMove(); // Sync sofort nach Rüstungswurf
}

/**
 * 🔒 SICHERE Version von rollDef mit Server-Würfeln
 * Wird von multiplayer.js aufgerufen
 */
async function rollDefSecure(){
  try {
    if (!currentRoom || !combat) {
      addLog('❌ Kein aktiver Kampf','err');
      return false;
    }

    const { att, def, ar, coverBonus: cov } = combat;
    const totalDef = def.def + cov;

    // 🔒 SERVER WÜRFELT RÜSTUNG!
    const diceResult = await callEdgeFunction('roll-dice', {
      game_id: currentGameId,
      move_id: combat.moveId || 'temp_' + Date.now(),
      roll_type: 'defense',
      dice_count: totalDef
    });

    // Echte Würfel vom Server verwenden!
    combat.dr = diceResult.rolls;

    const hitThresh = att.orkAtk ? 3 : 4;
    const hits = ar.filter(v => v >= hitThresh).length;
    const saves = combat.dr.filter(v => v >= 5).length;
    const wounds = Math.max(0, hits - saves);
    
    // 🔒 Schaden wird nur mit echten Server-Würfeln berechnet!
    const dmg = wounds > 0 ? wounds * (2 + Math.floor(Math.random() * 2)) : 0; // 1d6 Schaden
    def.hp = Math.max(0, def.hp - dmg);
    att.attacked = true;

    addLog(`${def.e} Rüstung [${combat.dr.join(',')}]${cov > 0 ? ` (+${cov} Deckung)` : ''}`, 'mov');
    if (dmg === 0) addLog(`🛡️ Abgewehrt! ${hits} Treffer, ${saves} Rettungen → 0 Schaden`, 'mis');
    else addLog(`💥 ${wounds} Wunden → ${dmg} Schaden! ${def.name} HP: ${def.hp}/${def.maxHp}`, 'hit');

    // Necron reanimation
    if (def.hp <= 0) {
      if (def.reanimation && !def.reanimated) {
        // Auch Reanimation vom Server würfeln
        const reanimResult = await callEdgeFunction('roll-dice', {
          game_id: currentGameId,
          move_id: combat.moveId || 'temp_' + Date.now(),
          roll_type: 'damage',
          dice_count: 1
        });
        
        const rr = reanimResult.rolls[0];
        addLog(`⚙️ Reanimationsprotokoll: ${def.e} würfelt ${rr}…`, 'cov');
        if (rr >= 5) {
          def.hp = 3;
          def.reanimated = true;
          addLog(`✅ ${def.name} steht wieder auf! (3 HP)`, 'cov');
        } else {
          addLog(`❌ Reanimation fehlgeschlagen — ${def.name} vernichtet!`, 'kil');
        }
      } else {
        addLog(`☠️ ${def.e} ${def.name} vernichtet!`, 'kil');
      }
    }

    combat = null;
    checkWin();
    renderGame();

    if (typeof sendMove === 'function') sendMove();
    return true;

  } catch (error) {
    addLog(`❌ Rüstungs-Würfel Fehler: ${error.message}`, 'err');
    console.error(error);
    return false;
  }
}

function checkWin(){
  const a=units.filter(u=>u.team==='a'&&alive(u)).length;
  const b=units.filter(u=>u.team==='b'&&alive(u)).length;
  const fa=FACTIONS[pickedFactions.a], fb=FACTIONS[pickedFactions.b];
  if(a===0){ addLog(`${fb.icon} ${fb.name} gewinnen!`,'kil'); phase='over'; }
  if(b===0){ addLog(`${fa.icon} ${fa.name} gewinnen!`,'kil'); phase='over'; }
}

// endTurn als var — damit multiplayer.js es überschreiben kann
// NICHT als "function endTurn()" deklarieren!
var endTurn = async function(){
  turn=turn==='a'?'b':'a';
  units.forEach(u=>{u.moved=false; u.attacked=false;});
  sel=null; hlM=[]; hlA=[]; phase='move'; combat=null;
  const fac=FACTIONS[pickedFactions[turn]];
  addLog(`--- ${fac.icon} ${fac.name} am Zug ---`,'sys');
  renderGame();
  // sendMove() wird von multiplayer.js nach dem Override aufgerufen
};

// ═══════════════════════════════════════════════════════════════
// 🔒 INTELLIGENTE WÜRFEL-WRAPPER
// Je nachdem ob Multiplayer aktiv ist, werden sichere oder unsichere Versionen verwendet
// ═══════════════════════════════════════════════════════════════

/**
 * Intelligente Angriffswürfel
 * - Wenn Multiplayer: nutzt Server (rollAtkSecure)
 * - Sonst: nutzt lokale Würfel (rollAtk)
 */
async function rollAtkHandler() {
  if (typeof multiplayerMode !== 'undefined' && multiplayerMode && typeof currentRoom !== 'undefined' && currentRoom) {
    // 🔒 MULTIPLAYER — Sichere Server-Würfel
    return await rollAtkSecure();
  } else {
    // 🎮 OFFLINE — Lokale Würfel (für schnelle Tests)
    rollAtk();
    return true;
  }
}

/**
 * Intelligente Rüstungswürfel
 * - Wenn Multiplayer: nutzt Server (rollDefSecure)
 * - Sonst: nutzt lokale Würfel (rollDef)
 */
async function rollDefHandler() {
  if (typeof multiplayerMode !== 'undefined' && multiplayerMode && typeof currentRoom !== 'undefined' && currentRoom) {
    // 🔒 MULTIPLAYER — Sichere Server-Würfel
    return await rollDefSecure();
  } else {
    // 🎮 OFFLINE — Lokale Würfel
    rollDef();
    return true;
  }
}

function selUnit(u){
  if(!alive(u)) return;
  
  // Im Multiplayer: gegnerische Einheiten nur anschauen erlaubt
  if(multiplayerMode && u.team !== myTeam) {
    sel = u;
    hlM = [];
    hlA = [];
    renderGame();
    return;
  }
  
  // Nur der aktuelle Spieler kann seine Einheiten kontrollieren
  if(u.team!==turn) return;
  
  sel=u; combat=null;
  hlM=phase==='move'?moveRange(u):[];
  hlA=phase==='attack'?atkCells(u):[];
  renderGame();
}

function clickCell(c,r){
  if(phase==='over') return;
  // Online: nichts tun wenn Gegner dran ist (außer Gegner-Einheiten anschauen)
  if(multiplayerMode && turn !== myTeam) {
    // Aber: Gegner-Einheiten können angeschaut werden
    const occ = uAt(c,r);
    if(occ && alive(occ)) { selUnit(occ); return; }
    return;
  }
  if(combat&&combat.step!=='roll_atk') return;
  const occ=uAt(c,r);
  // Kann JEDE Einheit anschauen (eigne & gegnerische)
  if(occ&&alive(occ)){ 
    // Wenn gegnerische Einheit und kein Combat gerade: nur anschauen
    if(occ.team!==turn && !combat) {
      selUnit(occ); 
      return;
    }
    // Wenn eigne Einheit: normal behandeln
    if(occ.team===turn) { 
      selUnit(occ); 
      return; 
    }
  }
  if(sel){
    if(phase==='move'&&!sel.moved){
      if(hlM.some(([hc,hr])=>hc===c&&hr===r)){
        sel.col=c; sel.row=r; sel.moved=true; hlM=[];
        addLog(`${sel.e} ${sel.name} → (${c},${r})`,'mov');
        renderGame();
        if(typeof sendMove==='function') sendMove(); // Sync sofort nach Bewegung
        return;
      }
    }
    if(phase==='attack'&&!sel.attacked){
      const tgt=uAt(c,r);
      if(tgt&&tgt.team!==turn&&dist(sel,tgt)<=sel.ar){
        startCombat(sel,tgt); hlA=[]; renderGame();
        if(typeof sendMove==='function') sendMove(); // Sync sofort nach Angriff
        return;
      }
    }
  }
  sel=null; hlM=[]; hlA=[]; combat=null; renderGame();
}
