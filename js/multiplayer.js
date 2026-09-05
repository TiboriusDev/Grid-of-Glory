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
var realtimeChannel = null;


// ═══════════════════════════════════════════════════════════════
// SCREEN-VERWALTUNG
// ═══════════════════════════════════════════════════════════════

function hideAllScreens() {
  ['screen-lobby','screen-waiting','screen-faction',
   'screen-waiting-map','screen-map','screen-game']
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


// ═══════════════════════════════════════════════════════════════
// RAUM ERSTELLEN & BEITRETEN
// ═══════════════════════════════════════════════════════════════

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function createRoom() {
  const code = generateCode();
  const { error } = await sb.from('games').insert({
    room_code:    code,
    lobby_status: 'waiting',
    faction_a:    null,
    faction_b:    null,
    map_config:   null,
    game_state:   null
  });
  if (error) {
    console.error('Raum erstellen fehlgeschlagen:', error.message);
    alert('Fehler beim Erstellen des Raums.');
    return;
  }
  multiplayerMode = true;
  myTeam          = 'a';
  currentRoom     = code;
  subscribeToRoom(code);
  showWaiting(code);
}

async function joinRoom(code) {
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

  await sb.from('games')
    .update({ lobby_status: 'factions' })
    .eq('room_code', currentRoom);

  subscribeToRoom(currentRoom);
  showFactionScreen();
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

  // ── Spiel läuft ──
  if (row.lobby_status === 'playing') {
    pickedFactions.a = row.faction_a;
    pickedFactions.b = row.faction_b;

    if (!row.game_state) return;

    const incoming = row.game_state;

    // Spielstart: Spieler B baut das Spielfeld auf
    if (units.length === 0) {
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
  const state = buildFullState();

  const { error } = await sb.from('games')
    .update({
      lobby_status: 'playing',
      map_config:   mapDef,
      game_state:   state
    })
    .eq('room_code', currentRoom);

  if (error) {
    console.error('Spiel starten fehlgeschlagen:', error.message);
    return;
  }

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
  return {
    turn,
    phase,
    lastMoveBy: myTeam,
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
  turn  = state.turn;
  phase = state.phase;
  if (state.log) logs = state.log;
  sel = null; hlM = []; hlA = []; combat = null;
}


// ═══════════════════════════════════════════════════════════════
// endTurn OVERRIDE
// game.js ruft endTurn() auf — wir ersetzen es hier damit
// im Online-Modus der Zug nach Supabase gesendet wird
// ═══════════════════════════════════════════════════════════════

const _endTurnBase = endTurn;

endTurn = async function() {
  _endTurnBase();
  if (multiplayerMode) {
    await sendMove();
  }
};


// ═══════════════════════════════════════════════════════════════
// EVENT LISTENER
// ═══════════════════════════════════════════════════════════════

// Lokal spielen
document.getElementById('btn-local').addEventListener('click', () => {
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
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
  showLobby();
});

// Zurück-Button im Spiel
document.getElementById('btn-back').addEventListener('click', () => {
  if (realtimeChannel) realtimeChannel.unsubscribe();
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
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