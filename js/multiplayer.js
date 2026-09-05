// ── CONFIG ── Deine Supabase-Werte hier eintragen
const SUPABASE_URL  = 'https://xtoesokrqxwyzhaoyete.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_tlbHszjzDO717ybGhkJFyQ_vlIXOZc8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let myTeam      = null;  // 'a' oder 'b'
let currentRoom = null;
let realtimeChannel = null;

// ── RAUM ERSTELLEN ────────────────────────────────────
async function createRoom() {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const initialState = buildState(); // aktuellen Spielstand verpacken

  const { error } = await sb.from('games').insert({
    room_code: code,
    state: initialState
  });

  if (error) { console.error(error); return; }

  myTeam = 'a';
  currentRoom = code;
  subscribeToRoom(code);
  showRoomCode(code);
}

// ── RAUM BEITRETEN ────────────────────────────────────
async function joinRoom(code) {
  const { data, error } = await sb
    .from('games')
    .select('state')
    .eq('room_code', code.toUpperCase())
    .single();

  if (error || !data) {
    alert('Raum nicht gefunden!');
    return;
  }

  myTeam = 'b';
  currentRoom = code.toUpperCase();
  applyState(data.state); // empfangenen State laden
  subscribeToRoom(currentRoom);
}

// ── REALTIME SUBSCRIPTION ─────────────────────────────
function subscribeToRoom(code) {
  if (realtimeChannel) realtimeChannel.unsubscribe();

  realtimeChannel = sb
    .channel(`game:${code}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'games',
      filter: `room_code=eq.${code}`
    }, payload => {
      // Nur anwenden wenn der Gegner gezogen hat
      if (payload.new.state.turn !== myTeam) {
        applyState(payload.new.state);
      }
    })
    .subscribe();
}

// ── ZUG SENDEN ────────────────────────────────────────
async function sendState() {
  if (!currentRoom) return;
  await sb
    .from('games')
    .update({ state: buildState() })
    .eq('room_code', currentRoom);
}

// ── STATE VERPACKEN ───────────────────────────────────
function buildState() {
  return {
    turn,
    phase,
    units: units.map(u => ({
      id: u.id, col: u.col, row: u.row,
      hp: u.hp, moved: u.moved,
      attacked: u.attacked, reanimated: u.reanimated
    })),
    log: logs.slice(0, 10) // nur die letzten 10 Einträge senden
  };
}

// ── STATE ANWENDEN ────────────────────────────────────
function applyState(state) {
  turn  = state.turn;
  phase = state.phase;

  // Nur Positions- und HP-Daten updaten, Einheitendefinitionen bleiben lokal
  state.units.forEach(su => {
    const u = units.find(u => u.id === su.id);
    if (u) {
      u.col = su.col; u.row = su.row;
      u.hp  = su.hp;  u.moved = su.moved;
      u.attacked = su.attacked;
      u.reanimated = su.reanimated;
    }
  });

  // Log zusammenführen
  su.log?.forEach(l => { if (!logs.find(e => e.msg === l.msg)) logs.unshift(l); });

  sel = null; hlM = []; hlA = []; combat = null;
  renderGame();
}

// ── UI EVENTS ─────────────────────────────────────────
document.getElementById('btn-local').addEventListener('click', () => {
  // Kein Multiplayer, direkt zur Völkerwahl
  showFaction();
  hideLobby();
});

document.getElementById('btn-create').addEventListener('click', async () => {
  showFaction(); // Völker & Karte zuerst auswählen
  hideLobby();
  multiplayerMode = true;
  // sendState() wird nach Spielstart aufgerufen
});

document.getElementById('btn-join').addEventListener('click', async () => {
  const code = document.getElementById('room-input').value.trim();
  if (!code) return;
  await joinRoom(code);
  hideLobby();
});

function showRoomCode(code) {
  document.getElementById('room-code-text').textContent = code;
  document.getElementById('room-code-display').style.display = '';
}
function hideLobby() {
  document.getElementById('screen-lobby').style.display = 'none';
}

// sendState nach jedem Zug aufrufen — in endTurn() hinzufügen:
// async function endTurn() { ...; await sendState(); }

async function testConnection() {
  const { data, error } = await sb.from('games').select('*');
  if (error) {
    console.error('❌ Verbindung fehlgeschlagen:', error.message);
  } else {
    console.log('✅ Supabase verbunden! Tabelle games:', data);
  }
}
testConnection();