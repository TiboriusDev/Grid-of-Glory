# Grid of Glory — TODO

## 1. Sync bei jeder Aktion
**Problem:** Gegner sieht Züge erst wenn „Zug beenden" geklickt wird.  
**Lösung:** `sendMove()` nach jeder Aktion aufrufen — Bewegung, Angriff, Würfeln.  
**Tradeoff:** Mehr Supabase-Traffic. Beim Free Tier (2 GB Realtime/Monat) sollte das
für normale Spielsitzungen trotzdem reichen. Alternativ: nur Bewegung sofort syncen,
Kampf erst nach Abschluss — Mittelweg.

---

## 2. Rematch nach Spielende
**Ablauf:**
- Gewinner-Screen erscheint mit zwei Buttons: „Rematch" und „Hauptmenü"
- Verlierer darf die neue Karte wählen (Völker bleiben gleich oder werden neu gewählt?)
- Spieler A/B Rollen bleiben — nur der Map-Screen öffnet sich beim Verlierer
- Supabase: `lobby_status` zurück auf `map`, `game_state` leeren

---

## 3. Gegnerische Figuren anschauen
**Verhalten:**
- Klick auf gegnerische Einheit zeigt Stats in der Sidebar (read-only)
- Kein Bewegen/Angreifen möglich — nur Info
- Visuell unterscheiden: z.B. andere Rahmenfarbe oder „👁️ Scouting"-Label in der Sidebar
- Im Online-Modus: auch wenn Gegner dran ist, eigene Figuren anschauen können

---

## 4. Würfeln aufteilen — Angreifer & Verteidiger
**Aktuell:** Angreifer würfelt beide (Angriff + Rüstung für Verteidiger).  
**Soll:** 
- Angreifer würfelt: Angriffswürfel
- Verteidiger würfelt: Rüstungswürfel (eigene Aktion, eigener Button)
- Im Online-Modus: Sync nach Angriffswurf → Verteidiger sieht Ergebnis und würfelt selbst
- Bedeutet: Kampf wird 3-stufig: `roll_atk` → sync → `roll_def` → sync → `resolve`

---

## 5. Sidebar & UI im Spiel überarbeiten
**Probleme:**
- Bewegen/Angriff-Buttons zu versteckt
- Würfel-Button nicht sofort sichtbar
- Aktionsbereich zu kompakt

**Ideen:**
- Fixe Action-Bar am unteren Bildschirmrand auf Mobile (wie bei Handy-Spielen)
- Große Icon-Buttons für Hauptaktionen: 🚶 Bewegen | ⚔️ Angreifen | ⏭️ Zug beenden
- Würfel-Button deutlich größer und zentriert, mit Animation
- Sidebar-Tabs: „Einheit" | „Aktionen" | „Log" — spart Platz auf Mobile
- Einheiteninfo kompakter, Aktionen prominenter

---

## Priorität (Vorschlag)
1. **TODO 5** — UI zuerst, macht alles besser nutzbar
2. **TODO 4** — Würfeln aufteilen, wichtig für Online-Fairness
3. **TODO 1** — Sync verbessern
4. **TODO 3** — Gegner anschauen
5. **TODO 2** — Rematch
