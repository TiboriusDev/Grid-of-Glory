// ═══════════════════════════════════════════════════════════════
// GRID OF GLORY — multiplayer.js
// Supabase Realtime Multiplayer — kompletter Lobby & Game Flow
// ═══════════════════════════════════════════════════════════════

// ── CONFIG — hier deine Supabase-Werte eintragen ──────────────
const SUPABASE_URL = 'https://DEIN-PROJEKT.supabase.co';
const SUPABASE_KEY = 'DEIN-ANON-KEY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── MULTIPLAYER STATE ─────────────────────────────────────────
// var (nicht let) damit game.js und render.js diese lesen können
// ohne Redeclaration-Fehler — NUR hier deklarieren!
var multiplayerMode = false;
var myTeam          = null;
var currentRoom     = null;
var realtimeChannel = null;

// Lobby-Status: waiting → factions → map → playing
// waiting  = Raum erstellt, B noch nicht da
// factions = beide drin, jeder wählt Volk
// map      = beide haben Volk, A wählt Karte
// playing  = Spiel läuft


// ═══════════════════════════════════════════════════════════════
// SCREEN-VERWALTUNG
// ═══════════════════════════════════════════════════════════════

function hideAllScreens() {
  ['screen-lobby', 'screen-waiting', 'screen-faction',
   'screen-waiting-map', 'screen-map', 'screen-game']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
}

function showLobby() {
  hideAllScreens();
  document.getElementById('screen-lobby').style.display = '';
  // Eingabefeld leeren
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
  // Zeige welche Völker gewählt wurden
  const fa = FACTIONS[pickedFactions.a];
  const fb = FACTIONS[pickedFactions.b];
  document.getElementById('waiting-map-factions').innerHTML =
    `${fa.icon} ${fa.name} vs ${fb.icon} ${fb.name}<br>
     <span style="color:var(--text-secondary);font-size:11px;">
       Warte auf Spieler A — Karte wird gewählt…
     </span>`;
}

function showFactionScreen() {
  hideAllScreens();
  document.getElementById('screen-faction').style.display = '';
  // Reset Faction-Pick für Online — jeder wählt nur sein eigenes Volk
  if (multiplayerMode) {
    renderFactionScreenOnline();
  } else {
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
// HILFSFUNKTIONEN
// ═══════════════════════════════════════════════════════════════

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function copyCode() {
  const code = document.getElementById('waiting-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const btn = document.getElementById('btn-copy-code');
    btn.textContent = '✅ Kopiert!';
    setTimeout(() => { btn.textContent = '📋 Code kopieren'; }, 2000);
  });
}


// ═══════════════════════════════════════════════════════════════
// RAUM ERSTELLEN
// ═══════════════════════════════════════════════════════════════

async function createRoom() {
  const code = generateCode();

  const { error } = await sb.from('games').insert({
    room_code:     code,
    lobby_status:  'waiting',
    faction_a:     null,
    faction_b:     null,
    map_config:    null,
    game_state:    null
  });

  if (error) {
    console.error('Raum erstellen fehlgeschlagen:', error.message);
    alert('Fehler beim Erstellen des Raums. Bitte nochmal versuchen.');
    return;
  }

  multiplayerMode = true;
  myTeam          = 'a';
  currentRoom     = code;

  subscribeToRoom(code);
  showWaiting(code);
}


// ═══════════════════════════════════════════════════════════════
// RAUM BEITRETEN
// ═══════════════════════════════════════════════════════════════

async function joinRoom(code) {
  const { data, error } = await sb
    .from('games')
    .select('*')
    .eq('room_code', code.toUpperCase())
    .single();

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

  // Status auf 'factions' setzen — beide können jetzt Volk wählen
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
      console.log('Realtime Status:', status);
    });
}

function handleRoomUpdate(row) {
  console.log('Room update:', row.lobby_status, row.faction_a, row.faction_b);

  if (row.lobby_status === 'factions') {
    // Spieler B ist beigetreten — A geht zur Völkerwahl
    if (myTeam === 'a') {
      showFactionScreen();
    }
    // Fortschritt anzeigen (wer hat schon gewählt)
    showFactionProgress(row);
    return;
  }

  if (row.lobby_status === 'map') {
    // Beide haben Volk gewählt — Karte wählen
    pickedFactions.a = row.faction_a;
    pickedFactions.b = row.faction_b;
    if (myTeam === 'a') {
      showMapScreen();
    } else {
      showWaitingForMap();
    }
    return;
  }

  if (row.lobby_status === 'playing') {
    // Spiel startet
    pickedFactions.a = row.faction_a;
    pickedFactions.b = row.faction_b;
    if (row.game_state) {
      applyFullState(row.game_state);
      showGame();
      renderGame();
    }
    return;
  }
}

// Fortschrittsanzeige während Völkerwahl
function showFactionProgress(row) {
  const el = document.getElementById('faction-online-progress');
  if (!el) return;

  const aChosen = row.faction_a
    ? `✅ ${FACTIONS[row.faction_a].icon} ${FACTIONS[row.faction_a].name}`
    : '⏳ wählt noch…';
  const bChosen = row.faction_b
    ? `✅ ${FACTIONS[row.faction_b].icon} ${FACTIONS[row.faction_b].name}`
    : '⏳ wählt noch…';

  el.innerHTML = `🔵 Spieler 1: ${aChosen}<br>🔴 Spieler 2: ${bChosen}`;

  // Wenn beide gewählt haben — nur Spieler A setzt Status auf 'map'
  if (row.faction_a && row.faction_b && myTeam === 'a') {
    console.log('Beide haben gewählt — setze Status auf map');
    sb.from('games')
      .update({ lobby_status: 'map' })
      .eq('room_code', currentRoom)
      .then(({ error }) => {
        if (error) console.error('Status map setzen fehlgeschlagen:', error.message);
        else console.log('Status → map gesetzt');
      });
  }
}

// Zeigt Fortschritt der Völkerwahl (wer hat schon gewählt)
function showFactionProgress(row) {
  const el = document.getElementById('faction-online-progress');
  if (!el) return;
  const aChosen = row.faction_a ? `✅ ${FACTIONS[row.faction_a].icon} ${FACTIONS[row.faction_a].name}` : '⏳ wählt noch…';
  const bChosen = row.faction_b ? `✅ ${FACTIONS[row.faction_b].icon} ${FACTIONS[row.faction_b].name}` : '⏳ wählt noch…';
  el.innerHTML = `🔵 Spieler 1: ${aChosen}<br>🔴 Spieler 2: ${bChosen}`;

  // Wenn beide gewählt haben → Status auf 'map' setzen (nur A macht das)
  if (row.faction_a && row.faction_b && myTeam === 'a') {
    sb.from('games')
      .update({ lobby_status: 'map' })
      .eq('room_code', currentRoom)
      .then(() => console.log('Status → map'));
  }
}

// Faction-Banner in der Spielansicht updaten
function updateFactionBanner() {
  const el = document.getElementById('game-faction-banner');
  if (!el || !pickedFactions.a || !pickedFactions.b) return;
  const fa = FACTIONS[pickedFactions.a];
  const fb = FACTIONS[pickedFactions.b];
  el.innerHTML = `<span style="color:${fa.color}">${fa.icon} ${fa.name}</span>
    <span style="color:var(--text-secondary);font-size:11px;"> vs </span>
    <span style="color:${fb.color}">${fb.icon} ${fb.name}</span>`;
}


// ═══════════════════════════════════════════════════════════════
// VOLK WÄHLEN (ONLINE)
// ═══════════════════════════════════════════════════════════════

// Rendert die Völkerwahl für Online-Modus (jeder wählt nur sein eigenes)
function renderFactionScreenOnline() {
  const container = document.getElementById('faction-online-container');
  if (!container) return;

  container.style.display = '';
  document.getElementById('faction-offline-container').style.display = 'none';

  const myLabel = myTeam === 'a' ? '🔵 Du bist Spieler 1 — wähle dein Volk:' : '🔴 Du bist Spieler 2 — wähle dein Volk:';
  document.getElementById('faction-online-label').textContent = myLabel;

  // Fortschrittsanzeige
  const prog = document.getElementById('faction-online-progress');
  prog.innerHTML = '⏳ Warte auf Gegner…';

  // Völker-Grid rendern
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
      // Visuell markieren
      grid.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      // Bestätigen-Button aktivieren
      document.getElementById('btn-confirm-faction-online').disabled = false;
      document.getElementById('btn-confirm-faction-online').dataset.faction = key;
    });

    grid.appendChild(card);
  });

  document.getElementById('btn-confirm-faction-online').disabled = true;
}

// Volk bestätigen und nach Supabase schreiben
async function confirmFactionOnline() {
  const btn = document.getElementById('btn-confirm-faction-online');
  const factionKey = btn.dataset.faction;
  if (!factionKey) return;

  const col = myTeam === 'a' ? 'faction_a' : 'faction_b';
  pickedFactions[myTeam] = factionKey;

  btn.disabled = true;
  btn.textContent = '⏳ Warte auf Gegner…';

  await sb.from('games')
    .update({ [col]: factionKey })
    .eq('room_code', currentRoom);
}


// ═══════════════════════════════════════════════════════════════
// SPIEL STARTEN (nur Spieler A)
// ═══════════════════════════════════════════════════════════════

async function startOnlineGame(mapDef) {
  loadGame(mapDef);

  const state = buildFullState();

  await sb.from('games')
    .update({
      lobby_status: 'playing',
      map_config:   mapDef,
      game_state:   state
    })
    .eq('room_code', currentRoom);

  showGame();
  renderGame();
}


// ═══════════════════════════════════════════════════════════════
// STATE — SENDEN & EMPFANGEN
// ═══════════════════════════════════════════════════════════════

// Kompletter State (Spielstart)
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

// Zug senden (nach endTurn)
async function sendMove() {
  if (!multiplayerMode || !currentRoom) return;
  await sb.from('games')
    .update({ game_state: buildMoveState() })
    .eq('room_code', currentRoom);
}

// Kompletten State anwenden (Spielstart bei Spieler B)
function applyFullState(state) {
  pickedFactions = state.pickedFactions;
  COLS  = state.mapConfig.cols;
  ROWS  = state.mapConfig.rows;
  tmap  = {};
  state.mapConfig.terrain.forEach(({ c, r, t }) => { tmap[tk(c, r)] = t; });

  // Einheiten aus State aufbauen
  units = state.units.map(su => {
    const fac = FACTIONS[su.factionKey];
    const rosterEntry = fac.roster.find(r => r.id === su.type) ||
                        fac.roster.find((r, i) => {
                          // Fallback: Index aus ID ableiten
                          const idx = parseInt(su.id) <= 4 ? parseInt(su.id) - 1 : parseInt(su.id) - 5;
                          return i === Math.max(0, idx % 4);
                        });
    const u = mkUnit(rosterEntry || fac.roster[0], su.team, su.id, su.col, su.row, su.factionKey);
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

// Nur Positionen/HP updaten (während des Spiels)
function applyMoveState(state) {
  state.units.forEach(su => {
    const u = units.find(u => u.id === su.id);
    if (!u) return;
    u.col       = su.col;
    u.row       = su.row;
    u.hp        = su.hp;
    u.moved     = su.moved;
    u.attacked  = su.attacked;
    u.reanimated = su.reanimated;
  });

  turn  = state.turn;
  phase = state.phase;

  // Neue Log-Einträge hinzufügen
  if (state.log) {
    state.log.forEach(entry => {
      if (!logs.find(e => e.msg === entry.msg)) logs.unshift(entry);
    });
  }

  sel = null; hlM = []; hlA = []; combat = null;
}


// ═══════════════════════════════════════════════════════════════
// endTurn OVERRIDE — Zug nach Supabase senden
// ═══════════════════════════════════════════════════════════════

// Originales endTurn aus game.js wird hier überschrieben
const _endTurnOriginal = endTurn;

async function endTurnMultiplayer() {
  _endTurnOriginal();        // lokale Logik ausführen
  if (multiplayerMode) {
    await sendMove();        // dann nach Supabase senden
  }
}

// endTurn ersetzen sobald DOM geladen ist
window.endTurn = endTurnMultiplayer;


// ═══════════════════════════════════════════════════════════════
// MAP START OVERRIDE — Online-Spielstart abfangen
// ═══════════════════════════════════════════════════════════════

document.getElementById('btn-map-start').addEventListener('click', async () => {
  if (!multiplayerMode) return; // Lokal wird in maps.js behandelt

  // Karte aus aktivem Tab holen (gleiche Logik wie in maps.js)
  let mapDef;
  if (activeMapTab.startsWith('p')) {
    mapDef = MAPS[parseInt(activeMapTab[1])];
  } else {
    // Editor-Karte
    const etm = {};
    edTerrain.forEach(({ c, r, t }) => { etm[`${c},${r}`] = t; });
    const free = [];
    for (let r = 0; r < edRows; r++)
      for (let c = 0; c < edCols; c++)
        if (!(etm[`${c},${r}`] > 0)) free.push([c, r]);
    const aSlots = free.filter(([c]) => c < Math.floor(edCols / 3)).slice(0, 4);
    const bSlots = free.filter(([c]) => c >= Math.ceil(edCols * 2 / 3)).slice(0, 4);
    mapDef = {
      name: 'Eigene Karte', cols: edCols, rows: edRows,
      terrain: edTerrain,
      starts: { a: aSlots, b: bSlots }
    };
  }

  await startOnlineGame(mapDef);
}, true); // capture:true damit dieser Handler vor maps.js feuert


// ═══════════════════════════════════════════════════════════════
// LOBBY UI — Event Listener
// ═══════════════════════════════════════════════════════════════

// Lokal spielen
document.getElementById('btn-local').addEventListener('click', () => {
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  showFaction();
});

// Raum erstellen
document.getElementById('btn-create').addEventListener('click', async () => {
  document.getElementById('btn-create').textContent = '⏳ Erstelle Raum…';
  document.getElementById('btn-create').disabled    = true;
  await createRoom();
  document.getElementById('btn-create').textContent = '🌐 Online — Raum erstellen';
  document.getElementById('btn-create').disabled    = false;
});

// Raum beitreten
document.getElementById('btn-join').addEventListener('click', async () => {
  const code = document.getElementById('room-input').value.trim();
  if (!code) {
    document.getElementById('join-error').style.display  = '';
    document.getElementById('join-error').textContent    = '⚠️ Bitte Code eingeben!';
    return;
  }
  document.getElementById('btn-join').textContent  = '⏳';
  document.getElementById('btn-join').disabled     = true;
  await joinRoom(code);
  document.getElementById('btn-join').textContent  = 'Beitreten';
  document.getElementById('btn-join').disabled     = false;
});

// Enter-Taste im Code-Feld
document.getElementById('room-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-join').click();
});

// Code kopieren
document.getElementById('btn-copy-code').addEventListener('click', copyCode);

// Warten abbrechen
document.getElementById('btn-cancel-wait').addEventListener('click', async () => {
  if (currentRoom) {
    await sb.from('games').delete().eq('room_code', currentRoom);
  }
  if (realtimeChannel) realtimeChannel.unsubscribe();
  multiplayerMode = false;
  myTeam          = null;
  currentRoom     = null;
  showLobby();
});

// Faction bestätigen (Online)
document.getElementById('btn-confirm-faction-online').addEventListener('click', confirmFactionOnline);

// Zurück zur Lobby aus Wartescreen
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