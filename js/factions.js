// ══════════════════════════════════════════════════════
// FACTIONS & ROSTERS
// ══════════════════════════════════════════════════════
const FACTIONS = {
  marines: {
    name: 'Space Marines', icon: '🪖', color: '#1a3a6e', bg: '#dce8f8',
    trait: 'Unerschütterlich', traitDesc: '+1 Rüstungswürfel im Deckungsbonus',
    traitColor: '#185FA5', traitBg: '#E6F1FB',
    desc: 'Elitekrieger des Imperiums. Stark in Rüstung und Feuerkraft, zuverlässig in allen Situationen.',
    roster: [
      { id:'sm1', name:'Tactical Marine', e:'🪖', hp:12, move:3, atk:3, ar:4, def:3, dmg:[2,5] },
      { id:'sm2', name:'Scout',           e:'🎯', hp:7,  move:5, atk:2, ar:6, def:1, dmg:[1,3] },
      { id:'sm3', name:'Terminator',      e:'🦾', hp:20, move:2, atk:2, ar:1, def:6, dmg:[4,8] },
      { id:'sm4', name:'Devastator',      e:'🔫', hp:9,  move:2, atk:4, ar:8, def:2, dmg:[2,6] },
    ]
  },
  orks: {
    name: 'Orks', icon: '💚', color: '#2d5a1b', bg: '#d8f0d0',
    trait: 'WAAAGH!', traitDesc: '+1 Bewegungsfeld pro Zug, Angriff startet bei 3+',
    traitColor: '#3B6D11', traitBg: '#EAF3DE',
    desc: 'Wilde Horde aus Chaos und Brutalität. Zahlreich, schnell und gefährlich im Nahkampf.',
    roster: [
      { id:'ok1', name:'Boy',       e:'👊', hp:8,  move:4, atk:3, ar:1, def:2, dmg:[2,4], orkAtk:true },
      { id:'ok2', name:'Nob',       e:'💪', hp:14, move:4, atk:4, ar:2, def:3, dmg:[3,6], orkAtk:true },
      { id:'ok3', name:'Tankbusta', e:'💣', hp:7,  move:3, atk:2, ar:5, def:1, dmg:[3,7], orkAtk:true },
      { id:'ok4', name:'Warboss',   e:'👑', hp:18, move:5, atk:5, ar:2, def:4, dmg:[4,8], orkAtk:true },
    ]
  },
  eldar: {
    name: 'Eldar', icon: '✨', color: '#6b2fa0', bg: '#ede0f8',
    trait: 'Vorhersicht', traitDesc: 'Kann einmal pro Zug Bewegung wiederholen',
    traitColor: '#534AB7', traitBg: '#EEEDFE',
    desc: 'Uraltes Volk mit überlegener Technik und Beweglichkeit. Zerbrechlich, aber unglaublich präzise.',
    roster: [
      { id:'el1', name:'Guardian',     e:'🌟', hp:6,  move:5, atk:2, ar:5, def:1, dmg:[1,4] },
      { id:'el2', name:'Dire Avenger', e:'⚡', hp:8,  move:5, atk:3, ar:6, def:2, dmg:[2,4] },
      { id:'el3', name:'Swooping Hawk',e:'🦅', hp:7,  move:6, atk:2, ar:7, def:1, dmg:[2,5] },
      { id:'el4', name:'Wraithlord',   e:'🗿', hp:22, move:3, atk:3, ar:3, def:4, dmg:[4,9] },
    ]
  },
  necrons: {
    name: 'Necrons', icon: '💀', color: '#1a5c2a', bg: '#d0f0d8',
    trait: 'Reanimationsprotokoll', traitDesc: 'Stirbt eine Einheit, wirft sie 1W6 — bei 5+ kehrt sie mit 3 HP zurück',
    traitColor: '#0F6E56', traitBg: '#E1F5EE',
    desc: 'Unsterbliche Maschinenkrieger. Langsam, aber kaum aufzuhalten — sie stehen einfach wieder auf.',
    roster: [
      { id:'nc1', name:'Warrior',        e:'🤖', hp:10, move:2, atk:2, ar:3, def:3, dmg:[2,4], reanimation:true },
      { id:'nc2', name:'Immortal',       e:'⚙️', hp:14, move:2, atk:3, ar:4, def:4, dmg:[3,6], reanimation:true },
      { id:'nc3', name:'Canoptek Wraith',e:'🕷️', hp:12, move:4, atk:3, ar:3, def:3, dmg:[2,5], reanimation:true },
      { id:'nc4', name:'Overlord',       e:'👾', hp:16, move:3, atk:4, ar:3, def:5, dmg:[3,7], reanimation:true },
    ]
  }
};