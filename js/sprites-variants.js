// Anhang zu sprites.js — Terrain-Varianten System

// ═══════════════════════════════════════════════════════════════
// 🎨 TERRAIN VARIANTEN — Jedes Feld bekommt ein random Sprite!
// ═══════════════════════════════════════════════════════════════

/**
 * Speichert die ausgewählte Variante pro Feld
 * Struktur: 'c,r' -> variantKey
 * z.B. { '0,0': 'grass_2', '1,0': 'grass_1', '1,1': 'grass_3' }
 */
let fieldVariants = {};

/**
 * Initialisiert die Terrain-Varianten beim Spiel-Start
 * Jedes Feld bekommt eine random Variante seiner Terrain-Typ-Klasse
 * 
 * USAGE:
 *   initTerrainVariants();  // Beim loadGame() aufrufen
 */
function initTerrainVariants() {
  fieldVariants = {};
  console.log('🎨 Initialisiere Terrain-Varianten für alle Felder...');
}

/**
 * Bestimmt eine random Variante für ein Terrain-Feld
 * Wird beim Rendering aufgerufen
 * 
 * @param {number} c - Column
 * @param {number} r - Row
 * @param {number} terrainType - Der Terrain-Typ (0=Gras, 1=Wasser, 2=Dirt)
 * @returns {string} Die Sprite-Key der Variante (z.B. 'grass_2')
 */
function getFieldVariantSprite(c, r, terrainType) {
  const key = `${c},${r}`;
  
  // Wenn bereits gecacht, return cached
  if (fieldVariants[key]) {
    return fieldVariants[key];
  }
  
  // Neue Variante wählen
  const variants = TERRAIN_VARIANTS[terrainType];
  if (!variants || variants.length === 0) {
    console.warn(`⚠️ Keine Varianten für Terrain-Typ ${terrainType}`);
    return null;
  }
  
  // Random Variante aus der Liste wählen
  const randomVariant = variants[Math.floor(Math.random() * variants.length)];
  fieldVariants[key] = randomVariant;
  
  return randomVariant;
}
