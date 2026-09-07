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

## 6. Aufstellungsphase vor Spielbeginn
**Ablauf:**
- Nach Kartenauswahl: jeder Spieler bekommt eine Aufstellungszone (z.B. die ersten 2-3 Reihen auf seiner Seite)
- Zone wird farblich markiert — Spieler darf seine Einheiten frei innerhalb dieser Zone platzieren
- Einheit anklicken → freies Feld in der Zone anklicken → Einheit steht dort
- Bestätigen-Button wenn alle Einheiten platziert sind
- Im Online-Modus: beide Spieler stellen gleichzeitig auf, Gegner sieht die Positionen erst wenn beide bestätigt haben (kein Vorteil durch frühe Info)
- Supabase: `lobby_status` → `deployment` als neuer Schritt zwischen `map` und `playing`
- Einheitenreihenfolge/Typ bleibt aus dem Roster, nur Position ändert sich

---

## Priorität (aktualisiert)
1. **TODO 5** — UI überarbeiten
2. **TODO 4** — Würfeln aufteilen
3. **TODO 6** — Aufstellungsphase ⬅ neu
4. **TODO 1** — Sync bei jeder Aktion
5. **TODO 3** — Gegner anschauen
6. **TODO 2** — Rematch
