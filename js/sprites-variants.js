// Anhang zu sprites.js — Terrain-Varianten System

// ═══════════════════════════════════════════════════════════════
// 🎨 TERRAIN VARIANTEN — Zufällige Abwechslung beim Rendering
// ═══════════════════════════════════════════════════════════════

/**
 * Speichert die ausgewählten Varianten pro Terrain-Typ
 * Struktur: { terrainType -> variantKey }
 * z.B. { '0': 'grass_2', '1': 'water_1', '2': 'dirt_3' }
 */
let terrainVariantSelection = {};

/**
 * Initialisiert die Terrain-Varianten beim Spiel-Start
 * Wählt für jeden Terrain-Typ zufällig eine Variante
 * 
 * USAGE:
 *   initTerrainVariants();  // Beim loadGame() aufrufen
 */
function initTerrainVariants() {
  terrainVariantSelection = {};
  
  // Für jeden Terrain-Typ eine Variante wählen
  Object.entries(TERRAIN_VARIANTS).forEach(([terrainType, variants]) => {
    if (variants && variants.length > 0) {
      // Random Variante aus der Liste wählen
      const randomVariant = variants[Math.floor(Math.random() * variants.length)];
      terrainVariantSelection[terrainType] = randomVariant;
      console.log(`🎨 Terrain ${terrainType}: ${randomVariant} gewählt`);
    }
  });
}

/**
 * Gibt die Sprite-Variante für einen bestimmten Terrain-Typ zurück
 * 
 * @param {number} terrainType - Der Terrain-Typ (0=Gras, 1=Wasser, 2=Dirt)
 * @returns {string} Die Sprite-Key der Variante (z.B. 'grass_2')
 */
function getTerrainVariantSprite(terrainType) {
  const variant = terrainVariantSelection[terrainType];
  if (!variant) {
    console.warn(`⚠️ Keine Variante für Terrain-Typ ${terrainType} gefunden`);
    return null;
  }
  return variant;
}

/**
 * Alternative: Falls man ALLE Felder unterschiedliche Varianten haben will
 * (mehr Abwechslung, aber mehr Komplexität)
 * 
 * Uncomment um zu verwenden:
 
// Speichert Varianten pro Feld: '5,5' -> 'grass_1'
let fieldVariants = {};

function initFieldVariants() {
  fieldVariants = {};
  // Wird später pro Feld gefüllt
}

function setFieldVariant(c, r, terrainType) {
  const key = `${c},${r}`;
  const variants = TERRAIN_VARIANTS[terrainType];
  if (variants && variants.length > 0) {
    const randomVariant = variants[Math.floor(Math.random() * variants.length)];
    fieldVariants[key] = randomVariant;
  }
}

function getFieldVariantSprite(c, r) {
  const key = `${c},${r}`;
  return fieldVariants[key] || null;
}

 */
