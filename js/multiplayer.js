// ═══════════════════════════════════════════════════════════════
// GRID OF GLORY — multiplayer.js
// Supabase Realtime Multiplayer — kompletter Lobby & Game Flow
// ═══════════════════════════════════════════════════════════════

// ── CONFIG — hier deine Supabase-Werte eintragen ──────────────
const SUPABASE_URL = 'https://xtoesokrqxwyzhaoyete.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tlbHszjzDO717ybGhkJFyQ_vlIXOZc8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── MULTIPLAYER STATE ─────────────────────────────────────────
// var damit kein Redeclaration-Fehler mit anderen Scripts
var multiplayerMode = false;
var myTeam          = null;
var currentRoom     = null;
  currentGameId   = null;  // room_code (z.B. "ABC123")
var currentGameId   = null;  // 🆕 Die echte game_id von Supabase
var realtimeChannel = null;

// ═══════════════════════════════════════════════════════════════
// 🔒 EDGE FUNCTION HELPER — Sichere Server-Validierung
// ═══════════════════════════════════════════════════════════════

/**
 * Ruft eine Supabase Edge Function mit Auth Token auf
 * 
 * VERWENDUNGSBEISPIELE:
 * 
 * 1️⃣ WÜRFELWURF (Server würfelt!):
 *    const diceResult = await callEdgeFunction('roll-dice', {
 *      game_id: 'game-123',
 *      move_id: 'move-456',
 *      roll_type: 'attack',  // 'attack' | 'defense' | 'damage'
 *      dice_count: 3
 *    });
 *    // Returns: { success: true, rolls: [4, 5, 2], total: 11, ... }
 * 
 * 2️⃣ TEAM-VALIDIERUNG:
 *    const teamResult = await callEdgeFunction('validate-team', {
 *      faction: 'humans',
 *      unit_ids: ['warrior_1', 'archer_1']
 *    });
 *    // Returns: { success: true, units: [{...}, {...}], ... }
 * 
 * 3️⃣ SPIELZUG-VALIDIERUNG:
 *    const moveResult = await callEdgeFunction('validate-move', {
 *      game_id: 'game-123',
 *      move_type: 'move_unit',
 *      unit_id: 'unit_1',
 *      from_pos: {col: 5, row: 5},
 *      to_pos: {col: 6, row: 5}
 *    });
 *    // Returns: { success: true, move_id: '...', ... }
 * 
 * @param {string} functionName - Name der Function (z.B. 'roll-dice')
 * @param {object} payload - Daten für die Function
 * @returns {object} Antwort vom Server
 */
async function callEdgeFunction(functionName, payload) {
  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  // Hole Auth Token vom Supabase Client
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    throw new Error("No session — bitte melden Sie sich an");
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Edge Function Fehler: ${response.status}`);
    }

    return result;

  } catch (error) {
    console.error(`Edge Function ${functionName} Fehler:`, error);
    throw error;
  }
}


// ═══════════════════════════════════════════════════════════════
// 🔄 RECONNECT — Nach Seiten-Reload ins Spiel zurück
// ═══════════════════════════════════════════════════════════════

/**
 * Überprüfe ob der User noch ein aktives Spiel hat
 * Wird aufgerufen nach dem Login
 */
async function reconnectToActiveGame() {
  if (!currentUser) return;
  
  try {
    const { data: games } = await sb
      .from('games')
      .select('*')
      .or(`player_a.eq.${currentUser.id},player_b.eq.${currentUser.id}`)
      .in('lobby_status', ['faction', 'teambuilder', 'map', 'deployment', 'game', 'over']);
    
    if (!games || games.length === 0) return;
    
    const game = games[0];
    multiplayerMode = true;
    currentRoom = game.room_code;
    currentGameId = game.id;
    myTeam = game.player_a === currentUser.id ? 'a' : 'b';
    
    console.log('🔄 Reconnect: Ins Spiel ' + currentRoom + ' zurück!');
    subscribeToRoom(currentRoom);
    
    if (game.lobby_status === 'game') showGame();
    else if (game.lobby_status === 'deployment') showDeployment();
    else showFactionScreen();
  } catch (err) { 
    console.error('Reconnect Error:', err); 
  }
}


// ═══════════════════════════════════════════════════════════════
// SCREEN-VERWALTUNG
// ═══════════════════════════════════════════════════════════════

function hideAllScreens() {
  ['screen-lobby','screen-waiting','screen-faction','screen-teambuilder-faction-select','screen-teambuilder',
   'screen-waiting-map','screen-map','screen-deployment','screen-game','screen-winner']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}

function showLobby() {
  hideAllScreens();
  document.getElementById('screen-lobby').style.display = '';
  const inp = document.getElementById('room-input');
  if (inp) inp.value = '';
  document.getElementById('join-error').style.display = 'none';
}

function showWaiting(code) {
  hideAllScreens();
  document.getElementById('screen-waiting').style.display = '';
  document.getElementById('waiting-code').textContent = code;
}

function showWaitingForMap() {
  hideAllScreens();
  document.getElementById('screen-waiting-map').style.display = '';
  const fa = FACTIONS[pickedFactions.a];
  const fb = FACTIONS[pickedFactions.b];
  document.getElementById('waiting-map-factions').innerHTML =
    `${fa.icon} ${fa.name} vs ${fb.icon} ${fb.name}<br>
     <span style="color:var(--text-secondary);font-size:11px;">
       Warte auf Spieler 1 — Karte wird gewählt…
     </span>`;
}

function showFactionScreen() {
  hideAllScreens();
  document.getElementById('screen-faction').style.display = '';
  if (multiplayerMode) {
    // Online: jeder wählt nur sein eigenes Volk
    document.getElementById('faction-offline-container').style.display = 'none';
    document.getElementById('faction-online-container').style.display  = '';
    renderFactionScreenOnline();
  } else {
    // Lokal: beide wählen nacheinander
    document.getElementById('faction-offline-container').style.display = '';
    document.getElementById('faction-online-container').style.display  = 'none';
    factionPickStep = 'a';
    pickedFactions  = { a: null, b: null };
    renderFactionScreen();
  }
}

function showMapScreen() {
  hideAllScreens();
  document.getElementById('screen-map').style.display = '';
  renderMapScreen();
}

function showGame() {
  hideAllScreens();
  document.getElementById('screen-game').style.display = '';
}

function showWinnerScreen() {
  hideAllScreens();
  document.getElementById('screen-winner').style.display = '';
  
  // Gewinner bestimmen — schau die letzte Log-Nachricht
  const fa = FACTIONS[pickedFactions.a];
  const fb = FACTIONS[pickedFactions.b];
  const winnerLog = logs[logs.length - 1];
  const isPlayerWinner = winnerLog && (
    (myTeam === 'a' && winnerLog.msg.includes(fa.name)) ||
    (myTeam === 'b' && winnerLog.msg.includes(fb.name))
  );
  
  const titleEl = document.getElementById('winner-title');
  const infoEl = document.getElementById('winner-info');
  
  if (isPlayerWinner) {
    titleEl.innerHTML = '🏆 Du hast gewonnen!';
    infoEl.innerHTML = `<div style="color:#4a8a2a;font-weight:600;">${winnerLog.msg}</div>`;
  } else {
    titleEl.innerHTML = '💔 Du hast verloren';
    infoEl.innerHTML = `<div style="color:#c85050;font-weight:600;">${winnerLog.msg}</div>`;
  }
  
  // Buttons verbinden
  document.getElementById('btn-rematch').onclick = startRematch;
  document.getElementById('btn-menu-after-game').onclick = showLobby;
}


// ═══════════════════════════════════════════════════════════════
// RAUM ERSTELLEN & BEITRETEN
// ═══════════════════════════════════════════════════════════════

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createRoom() {
  // ⚠️ Auth Check
  if (!currentUser) {
    alert('❌ Du musst angemeldet sein um Online zu spielen!');
    return;
  }

  const code = generateCode();
  const { data, error } = await sb.from('games').insert({
    room_code:    code,
    lobby_status: 'waiting',
    faction_a:    null,
    faction_b:    null,
    map_config:   null,
    game_state:   null
  }).select().single();  // 🆕 Hole die eingefügte Reihe mit ID zurück
  
  if (error) {
    console.error('Raum erstellen fehlgeschlagen:', error.message);
    alert('Fehler beim Erstellen des Raums.');
    return;
  }
  
  multiplayerMode = true;
  myTeam          = 'a';
  currentRoom     = code;
  currentGameId   = data.id;  // 🆕 Speichere die echte game_id
  console.log('✅ Raum erstellt:', { code, currentGameId });
  subscribeToRoom(code);
  showWaiting(code);
}

async function joinRoom(code) {
  // ⚠️ Auth Check
  if (!currentUser) {
    alert('❌ Du musst angemeldet sein um Online zu spielen!');
    document.getElementById('join-error').style.display = '';
    document.getElementById('join-error').textContent   = '❌ Du musst angemeldet sein!';
    return;
  }

  const { data, error } = await sb
    .from('games').select('*')
    .eq('room_code', code.toUpperCase()).single();

  if (error || !data) {
    document.getElementById('join-error').style.display = '';
    document.getElementById('join-error').textContent   = '❌ Raum nicht gefunden!';
    return;
  }
  if (data.lobby_status === 'playing') {
    document.getElementById('join-error').style.display = '';
    document.getElementById('join-error').textContent   = '❌ Spiel läuft bereits!';
    return;
  }

  multiplayerMode = true;
  myTeam          = 'b';
  currentRoom     = code.toUpperCase();
  currentGameId   = data.id;  // 🆕 Speichere die echte game_id
  console.log('✅ Raum beigetreten:', { code: currentRoom, currentGameId });

  await sb.from('games')
    .update({ lobby_status: 'factions' })
    .eq('room_code', currentRoom);

  subscribeToRoom(currentRoom);
  showFactionScreen();
}

async function startRematch() {
  // Rematch: Zurück zur Kartenauswahl
  if (!multiplayerMode || !currentRoom) {
    showLobby();
    return;
  }
  
  // Supabase aktualisieren: Zurück zum 'map' Status, game_state/deployment_state leeren
  const { error } = await sb.from('games')
    .update({
      lobby_status: 'map',
      game_state: null,
      deployment_state: null
    })
    .eq('room_code', currentRoom);
  
  if (error) {
    console.error('Rematch fehlgeschlagen:', error.message);
    alert('Fehler beim Starten des Rematch');
    return;
  }
  
  // Lokale Variablen zurücksetzen
  phase = 'move';
  units = [];
  sel = null;
  hlM = [];
  hlA = [];
  combat = null;
  deploymentMode = false;
  deploymentConfirmed = { a: false, b: false };
  logs = [];
  
  // Map-Screen anzeigen
  showMapScreen();
}


// ═══════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════

function subscribeToRoom(code) {
  if (realtimeChannel) realtimeChannel.unsubscribe();

  realtimeChannel = sb
    .channel(`room:${code}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'games',
      filter: `room_code=eq.${code}`
    }, payload => {
      handleRoomUpdate(payload.new);
    })
    .subscribe(status => {
      console.log('Realtime:', status);
    });
}

function handleRoomUpdate(row) {
  console.log('Update:', row.lobby_status, 'team:', myTeam);

  // ── Lobby-Phase: Völker wählen ──
  if (row.lobby_status === 'factions') {
    // Spieler A geht zur Völkerwahl wenn B beigetreten ist
    if (myTeam === 'a') showFactionScreen();
    // Fortschritt aktualisieren
    updateFactionProgress(row);
    // Wenn beide gewählt haben → A setzt Status auf 'map'
    if (row.faction_a && row.faction_b && myTeam === 'a') {
      sb.from('games')
        .update({ lobby_status: 'map' })
        .eq('room_code', currentRoom)
        .then(({ error }) => {
          if (error) console.error('map setzen fehlgeschlagen:', error.message);
        });
    }
    return;
  }

  // ── Lobby-Phase: Karte wählen ──
  if (row.lobby_status === 'map') {
    pickedFactions.a = row.faction_a;
    pickedFactions.b = row.faction_b;
    if (myTeam === 'a') {
      showMapScreen();
    } else {
      showWaitingForMap();
    }
    return;
  }

  // ── Aufstellungsphase ──
  if (row.lobby_status === 'deployment') {
    pickedFactions.a = row.faction_a;
    pickedFactions.b = row.faction_b;
    
    if (units.length === 0) {
      // Ersten Map laden
      const mapDef = row.map_config;
      loadGame(mapDef);
    }
    
    // Deployment-Status laden (wer bestätigt hat)
    if (row.deployment_state) {
      deploymentConfirmed = row.deployment_state.confirmed || { a: false, b: false };
      
      // Nur die Positionen des GEGNERS aktualisieren, nicht die eigenen!
      if (myTeam === 'a' && row.deployment_state.positions_b) {
        row.deployment_state.positions_b.forEach(({ id, col, row: r }) => {
          const u = units.find(u => u.id === id && u.team === 'b');
          if (u) { u.col = col; u.row = r; }
        });
      } else if (myTeam === 'b' && row.deployment_state.positions_a) {
        row.deployment_state.positions_a.forEach(({ id, col, row: r }) => {
          const u = units.find(u => u.id === id && u.team === 'a');
          if (u) { u.col = col; u.row = r; }
        });
      }
    }
    
    deploymentMode = true;
    renderDeploymentScreen();
    
    // Wenn beide bestätigt: Spieler A startet Spiel, B wartet auf 'playing'
    if (deploymentConfirmed.a && deploymentConfirmed.b && myTeam === 'a') {
      setTimeout(() => {
        startGameAfterDeployment();
      }, 500);
    }
    return;
  }

  // ── Spiel läuft ──
  if (row.lobby_status === 'playing') {
    pickedFactions.a = row.faction_a;
    pickedFactions.b = row.faction_b;

    if (!row.game_state) return;

    const incoming = row.game_state;

    // Spielstart: Spieler B baut das Spielfeld auf (oder nach Deployment)
    if (units.length === 0 || deploymentMode) {
      deploymentMode = false;
      applyFullState(incoming);
      showGame();
      renderGame();
      return;
    }

    // Zug-Update: nur anwenden wenn der Gegner gezogen hat
    if (incoming.lastMoveBy !== myTeam) {
      applyMoveState(incoming);
      renderGame();
    }
    return;
  }
}

// Fortschritt der Völkerwahl anzeigen
function updateFactionProgress(row) {
  const el = document.getElementById('faction-online-progress');
  if (!el) return;
  const aText = row.faction_a
    ? `✅ ${FACTIONS[row.faction_a].icon} ${FACTIONS[row.faction_a].name}`
    : '⏳ wählt noch…';
  const bText = row.faction_b
    ? `✅ ${FACTIONS[row.faction_b].icon} ${FACTIONS[row.faction_b].name}`
    : '⏳ wählt noch…';
  el.innerHTML = `🔵 Spieler 1: ${aText}<br>🔴 Spieler 2: ${bText}`;
}


// ═══════════════════════════════════════════════════════════════
// VOLK WÄHLEN (ONLINE)
// ═══════════════════════════════════════════════════════════════

function renderFactionScreenOnline() {
  const myLabel = myTeam === 'a'
    ? '🔵 Du bist Spieler 1 — wähle dein Volk:'
    : '🔴 Du bist Spieler 2 — wähle dein Volk:';
  document.getElementById('faction-online-label').textContent = myLabel;
  document.getElementById('faction-online-progress').innerHTML = '⏳ Warte auf Gegner…';

  const grid = document.getElementById('faction-online-grid');
  grid.innerHTML = '';

  Object.entries(FACTIONS).forEach(([key, fac]) => {
    const card = document.createElement('div');
    card.className = 'faction-card';
    card.innerHTML = `
      <div class="faction-name">${fac.icon} ${fac.name}</div>
      <div class="faction-desc">${fac.desc}</div>
      <div class="faction-trait" style="background:${fac.traitBg};color:${fac.traitColor}">
        ⚡ ${fac.trait}: ${fac.traitDesc}
      </div>
      <div class="roster-list">
        ${fac.roster.map(r => `${r.e} ${r.name} (BW:${r.move} AW:${r.ar} HP:${r.hp})`).join('<br>')}
      </div>`;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const btn = document.getElementById('btn-confirm-faction-online');
      btn.disabled = false;
      btn.dataset.faction = key;
    });
    grid.appendChild(card);
  });

  const confirmBtn = document.getElementById('btn-confirm-faction-online');
  confirmBtn.disabled = true;
  confirmBtn.textContent = '✅ Auswahl bestätigen';
}

async function confirmFactionOnline() {
  const btn = document.getElementById('btn-confirm-faction-online');
  const factionKey = btn.dataset.faction;
  if (!factionKey) return;

  pickedFactions[myTeam] = factionKey;
  btn.disabled    = true;
  btn.textContent = '⏳ Warte auf Gegner…';

  const col = myTeam === 'a' ? 'faction_a' : 'faction_b';
  const { error } = await sb.from('games')
    .update({ [col]: factionKey })
    .eq('room_code', currentRoom);

  if (error) console.error('Volk speichern fehlgeschlagen:', error.message);
}


// ═══════════════════════════════════════════════════════════════
// SPIEL STARTEN (nur Spieler A)
// ═══════════════════════════════════════════════════════════════

async function startOnlineGame(mapDef) {
  loadGame(mapDef);
  deploymentMode = true;
  deploymentConfirmed = { a: false, b: false };

  const { error } = await sb.from('games')
    .update({
      lobby_status: 'deployment',
      map_config:   mapDef,
      deployment_state: buildDeploymentState()
    })
    .eq('room_code', currentRoom);

  if (error) {
    console.error('Deployment starten fehlgeschlagen:', error.message);
    return;
  }

  renderDeploymentScreen();
}

async function startGameAfterDeployment() {
  const state = buildFullState();

  const { error } = await sb.from('games')
    .update({
      lobby_status: 'playing',
      game_state:   state,
      deployment_state: null
    })
    .eq('room_code', currentRoom);

  if (error) {
    console.error('Spiel starten fehlgeschlagen:', error.message);
    return;
  }

  deploymentMode = false;
  showGame();
  renderGame();
}


// ═══════════════════════════════════════════════════════════════
// STATE BAUEN & ANWENDEN
// ═══════════════════════════════════════════════════════════════

// Vollständiger State (Spielstart)
function buildFullState() {
  return {
    turn,
    phase,
    lastMoveBy: myTeam,
    pickedFactions,
    mapConfig: {
      cols: COLS,
      rows: ROWS,
      terrain: Object.entries(tmap).map(([key, t]) => {
        const [c, r] = key.split(',').map(Number);
        return { c, r, t };
      })
    },
    units: units.map(u => ({
      id:         u.id,
      type:       u.type,
      team:       u.team,
      factionKey: u.factionKey,
      col:        u.col,
      row:        u.row,
      hp:         u.hp,
      maxHp:      u.maxHp,
      moved:      u.moved,
      attacked:   u.attacked,
      reanimated: u.reanimated
    })),
    log: logs.slice(0, 15)
  };
}

// Nur Zug-Daten (während des Spiels)
function buildMoveState() {
  const combatData = combat ? {
    attId: combat.att.id,
    defId: combat.def.id,
    step: combat.step,
    ar: combat.ar,
    coverBonus: combat.coverBonus
  } : null;
  
  return {
    turn,
    phase,
    lastMoveBy: myTeam,
    combat: combatData,
    units: units.map(u => ({
      id:         u.id,
      col:        u.col,
      row:        u.row,
      hp:         u.hp,
      moved:      u.moved,
      attacked:   u.attacked,
      reanimated: u.reanimated
    })),
    log: logs.slice(0, 15)
  };
}

// Zug senden
async function sendMove() {
  if (!multiplayerMode || !currentRoom) return;
  const { error } = await sb.from('games')
    .update({ game_state: buildMoveState() })
    .eq('room_code', currentRoom);
  if (error) console.error('sendMove fehlgeschlagen:', error.message);
}

// Vollständigen State laden (Spieler B beim Spielstart)
function applyFullState(state) {
  COLS = state.mapConfig.cols;
  ROWS = state.mapConfig.rows;
  tmap = {};
  state.mapConfig.terrain.forEach(({ c, r, t }) => { tmap[tk(c, r)] = t; });

  units = state.units.map(su => {
    const fac = FACTIONS[su.factionKey];
    // Roster-Eintrag anhand der roster-ID finden
    const rosterEntry = fac.roster.find(r => r.id === su.type)
      || fac.roster[(su.id <= 4 ? su.id - 1 : su.id - 5) % fac.roster.length]
      || fac.roster[0];
    const u = mkUnit(rosterEntry, su.team, su.id, su.col, su.row, su.factionKey);
    u.hp         = su.hp;
    u.maxHp      = su.maxHp;
    u.moved      = su.moved;
    u.attacked   = su.attacked;
    u.reanimated = su.reanimated;
    return u;
  });

  turn  = state.turn;
  phase = state.phase;
  if (state.log) logs = state.log;
  sel = null; hlM = []; hlA = []; combat = null;
}

// Nur Positionen & HP updaten (laufendes Spiel)
function applyMoveState(state) {
  state.units.forEach(su => {
    const u = units.find(u => u.id === su.id);
    if (!u) return;
    u.col        = su.col;
    u.row        = su.row;
    u.hp         = su.hp;
    u.moved      = su.moved;
    u.attacked   = su.attacked;
    u.reanimated = su.reanimated;
  });
  
  // Combat-State wiederherstellen
  if (state.combat) {
    const att = units.find(u => u.id === state.combat.attId);
    const def = units.find(u => u.id === state.combat.defId);
    if (att && def) {
      combat = {
        att,
        def,
        step: state.combat.step,
        ar: state.combat.ar,
        dr: null,
        coverBonus: state.combat.coverBonus
      };
    }
  } else {
    combat = null;
  }
  
  turn  = state.turn;
  phase = state.phase;
  if (state.log) logs = state.log;
  sel = null; hlM = []; hlA = [];
}


// ═══════════════════════════════════════════════════════════════
// endTurn OVERRIDE
// game.js ruft endTurn() auf — wir ersetzen es hier damit
// im Online-Modus der Zug nach Supabase gesendet wird
// ═══════════════════════════════════════════════════════════════

// endTurn aus game.js überschreiben — funktioniert weil game.js es als var deklariert
const _endTurnBase = endTurn;

endTurn = async function() {
  await _endTurnBase();  // lokale Logik
  if (multiplayerMode) {
    await sendMove();    // Zug an Gegner senden
  }
};


// ═══════════════════════════════════════════════════════════════
// DEPLOYMENT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function buildDeploymentState() {
  // Nur EIGENE Positionen speichern, nicht die des Gegners
  const myPositions = units.filter(u => u.team === myTeam).map(u => ({
    id: u.id,
    col: u.col,
    row: u.row
  }));
  
  const posKey = myTeam === 'a' ? 'positions_a' : 'positions_b';
  const confirmed = { ...deploymentConfirmed };
  
  return {
    confirmed,
    [posKey]: myPositions
  };
}

async function confirmDeployment() {
  if (!multiplayerMode || !currentRoom) return;
  
  deploymentConfirmed[myTeam] = true;
  
  const { error } = await sb.from('games')
    .update({ deployment_state: buildDeploymentState() })
    .eq('room_code', currentRoom);
  
  if (error) console.error('Deployment bestätigen fehlgeschlagen:', error.message);
  else renderDeploymentScreen();
}


// ═══════════════════════════════════════════════════════════════
// EVENT LISTENER
// ═══════════════════════════════════════════════════════════════

// Lokal spielen
document.getElementById('btn-local').addEventListener('click', () => {
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  currentGameId   = null;
  showFactionScreen();
});

// Raum erstellen
document.getElementById('btn-create').addEventListener('click', async () => {
  const btn = document.getElementById('btn-create');
  btn.textContent = '⏳ Erstelle Raum…';
  btn.disabled    = true;
  await createRoom();
  btn.textContent = '🌐 Raum erstellen';
  btn.disabled    = false;
});

// Raum beitreten
document.getElementById('btn-join').addEventListener('click', async () => {
  const code = document.getElementById('room-input').value.trim();
  if (!code) {
    document.getElementById('join-error').style.display = '';
    document.getElementById('join-error').textContent   = '⚠️ Bitte Code eingeben!';
    return;
  }
  const btn = document.getElementById('btn-join');
  btn.textContent = '⏳';
  btn.disabled    = true;
  await joinRoom(code);
  btn.textContent = 'Beitreten';
  btn.disabled    = false;
});

// Enter im Code-Feld
document.getElementById('room-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// Code kopieren
document.getElementById('btn-copy-code').addEventListener('click', () => {
  const code = document.getElementById('waiting-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✅ Kopiert!';
    setTimeout(() => { btn.textContent = '📋 Code kopieren'; }, 2000);
  });
});

// Warten abbrechen
document.getElementById('btn-cancel-wait').addEventListener('click', async () => {
  if (currentRoom) await sb.from('games').delete().eq('room_code', currentRoom);
  if (realtimeChannel) realtimeChannel.unsubscribe();
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  currentGameId   = null;
  showLobby();
});

// Völkerwahl bestätigen (Online)
document.getElementById('btn-confirm-faction-online').addEventListener('click', confirmFactionOnline);

// Warten auf Karte abbrechen
document.getElementById('btn-cancel-wait-map').addEventListener('click', () => {
  if (realtimeChannel) realtimeChannel.unsubscribe();
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  currentGameId   = null;
  showLobby();
});

// Zurück-Button im Spiel
document.getElementById('btn-back').addEventListener('click', () => {
  if (realtimeChannel) realtimeChannel.unsubscribe();
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  currentGameId   = null;
  showLobby();
});

// Karte starten (Online-Modus) — capture:true damit es vor render.js feuert
document.getElementById('btn-map-start').addEventListener('click', async () => {
  if (!multiplayerMode) return;

  let mapDef;
  if (activeMapTab.startsWith('p')) {
    mapDef = MAPS[parseInt(activeMapTab[1])];
  } else {
    const etm = {};
    edTerrain.forEach(({ c, r, t }) => { etm[`${c},${r}`] = t; });
    const free = [];
    for (let r = 0; r < edRows; r++)
      for (let c = 0; c < edCols; c++)
        if (!etm[`${c},${r}`]) free.push([c, r]);
    const aSlots = free.filter(([c]) => c < Math.floor(edCols / 3)).slice(0, 4);
    const bSlots = free.filter(([c]) => c >= Math.ceil(edCols * 2 / 3)).slice(0, 4);
    mapDef = { name:'Eigene Karte', cols:edCols, rows:edRows,
               terrain:edTerrain, starts:{ a:aSlots, b:bSlots } };
  }
  await startOnlineGame(mapDef);
}, true);

// Deployment Buttons
document.getElementById('btn-deployment-confirm')?.addEventListener('click', () => {
  confirmDeployment();
});

document.getElementById('btn-back-deployment')?.addEventListener('click', () => {
  if (realtimeChannel) realtimeChannel.unsubscribe();
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  currentGameId   = null;
  deploymentMode  = false;
  showLobby();
});
