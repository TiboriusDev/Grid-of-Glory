// ══════════════════════════════════════════════════════
// SPRITE-SYSTEM KONFIGURATION
// ══════════════════════════════════════════════════════

// Sprite-Größen (in Pixeln)
const SPRITE_CONFIG = {
  unit: {
    width: 48,
    height: 48,
    scale: 1.5 // Skalierungsfaktor für größere Darstellung
  },
  terrain: {
    width: 40,
    height: 40,
    scale: 1
  },
  ui: {
    width: 32,
    height: 32,
    scale: 1
  }
};

// Unit-Sprites (Emojis als Fallback, später durch echte Sprites ersetzen)
const UNIT_SPRITES = {
  // Humans
  'warrior': { name: 'Krieger', emoji: '🧑‍🦰', sprite: 'units/warrior.png' },
  'wizard': { name: 'Zauberer', emoji: '🧙‍♂️', sprite: 'units/wizard.png' },
  'archer': { name: 'Bogenschütze', emoji: '🏹', sprite: 'units/archer.png' },
  'knight': { name: 'Ritter', emoji: '🛡️', sprite: 'units/knight.png' },
  'cleric': { name: 'Kleriker', emoji: '⛑️', sprite: 'units/cleric.png' },
  
  // Orcs
  'orc_warrior': { name: 'Orc-Krieger', emoji: '👹', sprite: 'units/orc_warrior.png' },
  'orc_shaman': { name: 'Orc-Schamane', emoji: '🧌', sprite: 'units/orc_shaman.png' },
  'goblin': { name: 'Goblin', emoji: '👽', sprite: 'units/goblin.png' },
  'troll': { name: 'Troll', emoji: '💚', sprite: 'units/troll.png' },
  
  // Undead
  'skeleton': { name: 'Skelett', emoji: '💀', sprite: 'units/skeleton.png' },
  'zombie': { name: 'Zombie', emoji: '🧟‍♂️', sprite: 'units/zombie.png' },
  'ghost': { name: 'Geist', emoji: '👻', sprite: 'units/ghost.png' },
  'lich': { name: 'Lich', emoji: '☠️', sprite: 'units/lich.png' },
};

// Gelände-Sprites (Basis-Layer)
const TERRAIN_BASE_SPRITES = {
  0: { name: 'Gras', sprite: 'terrain/grass.png', emoji: '🌱' },
  1: { name: 'Wasser', sprite: 'terrain/water.png', emoji: '💧' },
  2: { name: 'Schmutz', sprite: 'terrain/dirt.png', emoji: '🟤' },
};

// Gelände-Objekt-Sprites (Overlay-Layer)
const TERRAIN_OBJECT_SPRITES = {
  0: { name: '', sprite: '', emoji: '' },           // Nichts
  1: { name: 'Wand', sprite: 'terrain/wall.png', emoji: '🧱' },
  2: { name: 'Deckung', sprite: 'terrain/cover.png', emoji: '📦' },
  3: { name: 'Baum', sprite: 'terrain/tree.png', emoji: '🌲' },
};

// Fraktions-Sprites (für UI)
const FACTION_SPRITES = {
  humans: { sprite: 'factions/humans_icon.png', emoji: '⚔️' },
  orcs: { sprite: 'factions/orcs_icon.png', emoji: '🗡️' },
  undead: { sprite: 'factions/undead_icon.png', emoji: '☠️' },
};

// ══════════════════════════════════════════════════════
// HILFSFUNKTIONEN FÜR SPRITES
// ══════════════════════════════════════════════════════

/**
 * Erstellt ein Sprite-HTML-Element
 * @param {string} spriteType - 'unit', 'terrain', 'faction'
 * @param {string} spriteKey - Schlüssel des Sprites
 * @param {object} options - Zusätzliche Optionen
 * @returns {HTMLElement} Das Sprite-Element
 */
function createSpriteElement(spriteType, spriteKey, options = {}) {
  const div = document.createElement('div');
  div.className = `sprite sprite-${spriteType}`;
  
  let spriteData = null;
  
  switch(spriteType) {
    case 'unit':
      spriteData = UNIT_SPRITES[spriteKey];
      break;
    case 'terrain-base':
      spriteData = TERRAIN_BASE_SPRITES[spriteKey];
      break;
    case 'terrain-object':
      spriteData = TERRAIN_OBJECT_SPRITES[spriteKey];
      break;
    case 'faction':
      spriteData = FACTION_SPRITES[spriteKey];
      break;
  }
  
  if (!spriteData) {
    console.warn(`Sprite nicht gefunden: ${spriteType}/${spriteKey}`);
    div.textContent = '❓';
    return div;
  }
  
  // Versuche Sprite zu laden, fallback auf Emoji
  const spritePath = `sprites/${spriteData.sprite}`;
  const img = document.createElement('img');
  img.src = spritePath;
  img.alt = spriteData.name || 'Sprite';
  img.className = 'sprite-img';
  img.onerror = () => {
    // Fallback zu Emoji wenn Sprite-Datei nicht vorhanden
    img.style.display = 'none';
    div.textContent = spriteData.emoji;
    div.classList.add('sprite-emoji');
  };
  img.onload = () => {
    div.classList.add('sprite-loaded');
  };
  
  div.appendChild(img);
  
  // Zusätzliche Styles aus Options
  if (options.style) {
    Object.assign(div.style, options.style);
  }
  
  return div;
}

/**
 * Erstellt einen Sprite-Hintergrund als CSS
 * @param {string} spriteType - 'unit', 'terrain', 'faction'
 * @param {string} spriteKey - Schlüssel des Sprites
 * @returns {string} CSS background-image Wert
 */
function getSpriteBackgroundUrl(spriteType, spriteKey) {
  let spriteData = null;
  
  switch(spriteType) {
    case 'unit':
      spriteData = UNIT_SPRITES[spriteKey];
      break;
    case 'terrain-base':
      spriteData = TERRAIN_BASE_SPRITES[spriteKey];
      break;
    case 'terrain-object':
      spriteData = TERRAIN_OBJECT_SPRITES[spriteKey];
      break;
    case 'faction':
      spriteData = FACTION_SPRITES[spriteKey];
      break;
  }
  
  if (!spriteData) return '';
  return `url('sprites/${spriteData.sprite}')`;
}

/**
 * Gibt den Emoji-Fallback für ein Sprite zurück
 * @param {string} spriteType - 'unit', 'terrain-base', 'terrain-object', 'faction'
 * @param {string} spriteKey - Schlüssel des Sprites
 * @returns {string} Emoji
 */
function getSpriteEmoji(spriteType, spriteKey) {
  let spriteData = null;
  
  switch(spriteType) {
    case 'unit':
      spriteData = UNIT_SPRITES[spriteKey];
      break;
    case 'terrain-base':
      spriteData = TERRAIN_BASE_SPRITES[spriteKey];
      break;
    case 'terrain-object':
      spriteData = TERRAIN_OBJECT_SPRITES[spriteKey];
      break;
    case 'faction':
      spriteData = FACTION_SPRITES[spriteKey];
      break;
  }
  
  return spriteData?.emoji || '❓';
}

/**
 * Lädt eine Sprite-Datei als Bild
 * @param {string} spritePath - Pfad zur Sprite-Datei
 * @returns {Promise} Auflösung wenn Bild geladen
 */
function loadSpriteImage(spritePath) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Konnte Sprite nicht laden: ${spritePath}`));
    img.src = spritePath;
  });
}
