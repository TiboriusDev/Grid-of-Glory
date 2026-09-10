// ═══════════════════════════════════════════════════════
// TEAMBUILDER.JS — Team-Zusammenstellung & Verwaltung
// Spieler wählt Einheiten aus einer Fraktion (Max 6 Units)
// ═══════════════════════════════════════════════════════

// ── GLOBAL STATE ──────────────────────────────────────
let teamBuilderMode = false;
let teamBuilderFaction = null;
let currentTeamName = '';
let currentTeamUnits = []; // 🔒 SICHER: Nur Unit-IDs! ['unit_1', 'unit_2', ...]

// ── SCREEN VERWALTUNG ──────────────────────────────────
function showTeamBuilderFactionSelect() {
  if (typeof hideAllScreens === 'undefined') {
    console.error('hideAllScreens ist noch nicht geladen!');
    return;
  }
  hideAllScreens();
  document.getElementById('screen-teambuilder-faction-select').style.display = '';
  renderTeamBuilderFactionSelect();
}

function renderTeamBuilderFactionSelect() {
  const container = document.getElementById('teambuilder-faction-grid');
  container.innerHTML = '';
  
  Object.entries(FACTIONS).forEach(([key, faction]) => {
    const card = document.createElement('div');
    card.className = 'faction-card';
    card.innerHTML = `
      <div style="font-size:24px;margin-bottom:6px;">${faction.icon}</div>
      <div class="faction-name">${faction.name}</div>
      <div class="faction-trait">${faction.trait}</div>
      <div class="faction-desc" style="font-size:10px;margin-bottom:8px;">${faction.traitDesc}</div>
      <button class="big-btn" style="width:100%;background:linear-gradient(135deg,#8a6520,#c8973a);border-color:#c8973a;font-size:11px;">
        Wählen
      </button>
    `;
    
    card.querySelector('button').addEventListener('click', () => {
      showTeamBuilder(key);
    });
    
    container.appendChild(card);
  });
}

function showTeamBuilder(faction) {
  hideAllScreens();
  document.getElementById('screen-teambuilder').style.display = '';
  
  teamBuilderMode = true;
  teamBuilderFaction = faction;
  currentTeamUnits = [];
  currentTeamName = '';
  
  renderTeamBuilder();
}

function hideTeamBuilder() {
  teamBuilderMode = false;
  document.getElementById('screen-teambuilder').style.display = 'none';
}

// ── RENDER ────────────────────────────────────────────
function renderTeamBuilder() {
  const faction = FACTIONS[teamBuilderFaction];
  const MAX_UNITS = 6;
  
  // Titel & Info
  document.getElementById('teambuilder-faction').textContent = `${faction.icon} ${faction.name} — Team zusammenstellen`;
  document.getElementById('teambuilder-count').textContent = `${currentTeamUnits.length}/${MAX_UNITS} Einheiten`;
  
  // Verfügbare Einheiten (nicht im Team)
  const availableContainer = document.getElementById('teambuilder-available');
  availableContainer.innerHTML = '';
  
  faction.roster.forEach(unit => {
    const isSelected = currentTeamUnits.includes(unit.id); // 🔒 Nur IDs vergleichen
    const canAdd = currentTeamUnits.length < MAX_UNITS;
    
    const card = document.createElement('div');
    card.className = `teambuilder-unit-card ${isSelected ? 'selected' : ''}`;
    card.style.opacity = (isSelected || !canAdd) && !isSelected ? '0.5' : '1';
    card.innerHTML = `
      <div class="unit-name">${unit.e} ${unit.name}</div>
      <div class="unit-stats">
        ❤️${unit.hp} 🚶${unit.move} ⚔️${unit.atk} 🛡️${unit.ar} 🎯${unit.def}
      </div>
      <button class="unit-action-btn" ${(isSelected || !canAdd) ? 'disabled' : ''}>
        ${isSelected ? '✓ Im Team' : '+ Hinzufügen'}
      </button>
    `;
    
    if (!isSelected && canAdd) {
      card.querySelector('.unit-action-btn').addEventListener('click', () => {
        addUnitToTeam(unit.id); // 🔒 Speichere nur die ID!
      });
    }
    
    availableContainer.appendChild(card);
  });
  
  // Aktuelles Team
  const teamContainer = document.getElementById('teambuilder-current');
  teamContainer.innerHTML = '<h4>Dein Team:</h4>';
  
  if (currentTeamUnits.length === 0) {
    teamContainer.innerHTML += '<div class="team-empty">Keine Einheiten ausgewählt</div>';
  } else {
    const teamList = document.createElement('div');
    teamList.className = 'team-list';
    
    currentTeamUnits.forEach(unitId => {
      // 🔒 Hole echte Stats vom Server (FACTIONS)
      const unit = faction.roster.find(u => u.id === unitId);
      if (!unit) return; // Sicherheit: Unit sollte existieren
      
      const item = document.createElement('div');
      item.className = 'team-unit-item';
      item.innerHTML = `
        <span>${unit.e} ${unit.name}</span>
        <button class="remove-btn" data-unit-id="${unitId}">✕</button>
      `;
      
      item.querySelector('.remove-btn').addEventListener('click', () => {
        removeUnitFromTeam(unitId);
      });
      
      teamList.appendChild(item);
    });
    
    teamContainer.appendChild(teamList);
  }
}

// ── TEAM MANIPULATION ─────────────────────────────────
function addUnitToTeam(unitId) {
  if (currentTeamUnits.length >= 6) {
    alert('❌ Maximal 6 Einheiten pro Team!');
    return;
  }
  
  // 🔒 Speichere NUR die Unit-ID, nicht die ganzen Stats!
  if (!currentTeamUnits.includes(unitId)) {
    currentTeamUnits.push(unitId);
  }
  renderTeamBuilder();
}

function removeUnitFromTeam(unitId) {
  // 🔒 Entferne die Unit-ID
  currentTeamUnits = currentTeamUnits.filter(id => id !== unitId);
  renderTeamBuilder();
}

// ── TEAM SPEICHERN ────────────────────────────────────
async function saveCurrentTeam() {
  if (currentTeamUnits.length === 0) {
    alert('❌ Füg mindestens 1 Einheit hinzu!');
    return;
  }
  
  if (!currentUser) {
    alert('❌ Du musst angemeldet sein um Teams zu speichern!');
    return;
  }
  
  // Team-Name von User
  const teamName = prompt('Team-Name eingeben:', `Team ${new Date().toLocaleDateString()}`);
  if (!teamName) return; // User hat Abbrechen geklickt
  
  try {
    // 🔒 Speichere ONLY Unit-IDs, nicht die kompletten Stats!
    const teamData = {
      user_id: currentUser.id,
      team_name: teamName,
      faction: teamBuilderFaction,
      unit_ids: JSON.stringify(currentTeamUnits), // ['unit_1', 'unit_2', ...]
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await sb.from('user_teams').insert(teamData).select();
    
    if (error) {
      alert(`❌ Fehler: ${error.message}`);
      console.error('Team-Speicher-Fehler:', error);
      return;
    }
    
    alert('✅ Team gespeichert!');
    console.log('Team gespeichert:', data);
    
  } catch (err) {
    alert(`❌ Fehler: ${err.message}`);
    console.error('Fehler beim Speichern:', err);
  }
}

// ── TEAM LADEN ──────────────────────────────────────
async function loadUserTeams() {
  if (!currentUser) return [];
  
  try {
    const { data, error } = await sb
      .from('user_', teamBuilderFaction) // faction statt faction_a
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Teams-Lade-Fehler:', error);
      return [];
    }
    
    // 🔒 Lade Unit-IDs und rekonstruiere Stats vom Server!
    return (data || []).map(t => ({
      ...t,
      unit_ids: JSON.parse(t.unit_ids), // ['unit_1', 'unit_2', ...]
      // Stats NICHT mehr speichern, werden vom Server geholt!
    }));
    
  } catch (err) {
    console.error('Fehler beim Laden:', err);
    return [];
  }
}

// ── TEAM ANWENDEN ──────────────────────────────────────
async function applyTeam(teamId) {
  if (!currentUser) {
    alert('❌ Du musst angemeldet sein!');
    return;
  }
  
  try {
    // Team aus DB laden
    const { data, error } = await sb
      .from('user_teams')
      .select('*')
      .eq('id', teamId)
      .eq('user_id', currentUser.id)
      .single();
    
    if (error) {
      alert('❌ Team nicht gefunden!');
      return;
    }
    
    // 🔒 Team anwenden - Lade nur die Unit-IDs!
    const unitIds = JSON.parse(data.unit_ids);
    currentTeamUnits = unitIds; // ['unit_1', 'unit_2', ...]
    teamBuilderFaction = data.faction;
    currentTeamName = data.team_name;
    
    console.log('✅ Team angewendet:', currentTeamName);
    alert(`✅ Team "${currentTeamName}" ausgewählt!`);
    
    // Zurück zur Lobby
    hideTeamBuilder();
    showLobby();
    
  } catch (err) {
    alert(`❌ Fehler: ${err.message}`);
    console.error('Fehler beim Anwenden:', err);
  }
}

// ── TEAM ZUM SPIEL ÜBERGEBEN ───────────────────────────
function applyTeamToGame() {
  if (currentTeamUnits.length === 0) {
    alert('❌ Wähle erst ein Team!');
    return false;
  }
  
  // 🔒 WICHTIG: Rekonstruiere echte Unit-Stats vom Server
  const faction = FACTIONS[teamBuilderFaction];
  const gameUnits = currentTeamUnits.map(unitId => {
    const canonical = faction.roster.find(u => u.id === unitId);
    if (!canonical) {
      alert('❌ Unit nicht in Fraktion gefunden! Mögliche Manipulaton?');
      return null;
    }
    // Kopiere NUR die kanonischen Stats vom Server!
    return { ...canonical, team: 'a' };
  }).filter(u => u !== null);
  
  if (gameUnits.length === 0) {
    alert('❌ Keine gültigen Einheiten!');
    return false;
  }
  
  // Übergebe dem Spiel
  pickedFactions.a = teamBuilderFaction;
  window.customTeamUnits = gameUnits; // Mit echten Stats vom Server!
  
  console.log('✅ Team zum Spiel übergeben:', {
    faction: teamBuilderFaction,
    units: gameUnits.length,
    teamName: currentTeamName
  });
  
  return true;
}

// ── HILFSFUNKTION: Team-Manager UI ─────────────────────
async function showTeamManager() {
  if (!currentUser) {
    alert('❌ Bitte melde dich an!');
    return;
  }
  
  // Modal zum Team laden
  const factionKey = prompt('Fraktion eingeben (marines/orks/eldar/necrons):').toLowerCase();
  if (!factionKey || !FACTIONS[factionKey]) {
    alert('❌ Unbekannte Fraktion!');
    return;
  }
  
  const teams = await loadUserTeams(); // Das sollte gefiltert nach fraktion sein
  
  if (teams.length === 0) {
    alert('❌ Keine Teams für diese Fraktion gespeichert!');
    return;
  }
  
  // Einfaches Text-Select (später bessere UI)
  let teamList = 'Deine Teams:\n\n';
  teams.forEach((t, i) => {
    teamList += `${i + 1}. ${t.team_name} (${t.units.length} Units)\n`;
  });
  
  const choice = prompt(teamList + '\nTeam-Nummer (0 zum Abbrechen):');
  if (!choice || choice === '0') return;
  
  const selectedTeam = teams[parseInt(choice) - 1];
  if (!selectedTeam) {
    alert('❌ Ungültige Auswahl!');
    return;
  }
  
  await applyTeam(selectedTeam.id);
}
