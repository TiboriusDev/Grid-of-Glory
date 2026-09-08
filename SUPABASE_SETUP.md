# Supabase Setup für Grid of Glory — GitHub Pages Anleitung

## 1️⃣ Discord OAuth App registrieren (5 Min)

### Schritt 1: Discord Developer Portal öffnen
- Gehe zu: https://discord.com/developers/applications
- Klicke "New Application"
- Name: `Grid of Glory`
- Akzeptiere die Bedingungen und klicke "Create"

### Schritt 2: OAuth2 konfigurieren
- Linke Sidebar → "OAuth2" → "General"
- **Kopiere:** Client ID (brauchst du später)
- Klicke "Reset Secret" und **kopiere:** Client Secret

### Schritt 3: Redirect URLs hinzufügen (WICHTIG für GitHub Pages!)
- Unter "OAuth2" → "General" → "Redirects"
- **Lösche alle alten URLs** und füge DIESE ein:
  ```
  https://xtoesokrqxwyzhaoyete.supabase.co/auth/v1/callback
  https://tiboriusdev.github.io/Grid-of-Glory
  https://tiboriusdev.github.io/Grid-of-Glory/
  ```
  ⚠️ **Genau so — mit UND ohne Slash am Ende!**
- Speichern (Save Changes)

---

## 2️⃣ Supabase konfigurieren (10 Min)

### Schritt 1: Zu deinem Supabase Projekt gehen
- Gehe zu: https://app.supabase.com
- Wähle dein Projekt (Grid-of-Glory)

### Schritt 2: Discord als Auth-Provider aktivieren
- Linke Sidebar → "Authentication" → "Providers"
- Suche "Discord" und klicke darauf
- **Paste hier ein:**
  - Client ID: (von Discord kopiert)
  - Client Secret: (von Discord kopiert)
- Häkchen setzen bei "Enabled"
- Klicke "Save"

### Schritt 3: Email/Passwort Auth aktivieren
- Gehe zu "Authentication" → "Providers"
- "Email" sollte bereits enabled sein
- Falls nicht: klick drauf und "Enable"
- Speichern

### Schritt 4: CORS für GitHub Pages aktivieren

**Weg 1: Über Project Settings (NEUE UI)**
1. Klick auf **⚙️ (Settings)** rechts oben
2. Linke Sidebar → **"API"** klicken
3. Scrolle nach unten bis **"CORS Configuration"**
4. Klick **"+ Add origin"**
5. Gib ein: `https://tiboriusdev.github.io`
6. Klick **"Save"**

**Falls du "CORS Configuration" nicht siehst:**

Versuche Weg 2:
1. Klick auf **⚙️ (Settings)** rechts oben
2. Links unten auf **"Database"** (oder "Konfiguration")
3. Suche nach **"CORS"** oder **"API"**
4. Dort findest du die Einstellung

**Falls CORS gar nicht existiert:**

Das ist OK! Supabase konfiguriert CORS automatisch für `localhost` und deine Domain. Du kannst diesen Schritt auch überspringen — teste einfach und schreib mir wenn es nicht funktioniert.

### Schritt 5: Email Confirmation ausschalten (Optional)
- "Authentication" → "Email Templates"
- Unter "Confirm signup" — rechts "Disable" klicken
- (So müssen Spieler Email nicht bestätigen)

---

## 3️⃣ Datenbank-Tabellen erstellen (5 Min)

### Gehe zu: SQL Editor → "New Query"

#### Query 1: user_teams Tabelle
```sql
CREATE TABLE user_teams (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT NOT NULL,
  faction_a TEXT NOT NULL,
  faction_b TEXT NOT NULL,
  units JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE user_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own teams"
  ON user_teams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own teams"
  ON user_teams FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own teams"
  ON user_teams FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own teams"
  ON user_teams FOR DELETE
  USING (auth.uid() = user_id);
```

Drücke "Run" und warte bis grün ✅

---

## 4️⃣ Deine Supabase-Keys überprüfen

- Gehe zu "Project Settings" (⚙️ rechts oben)
- Klick auf "API"
- Kopiere:
  - **Project URL**: (Deine URL)
  - **anon key**: (Dein Key)

Diese stehen bereits in `js/multiplayer.js` Zeile 7-8:

```javascript
const SUPABASE_URL = 'https://xtoesokrqxwyzhaoyete.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tlbHszjzDO717ybGhkJFyQ_vlIXOZc8';
```

Falls nicht → aktualisieren!

---

## 5️⃣ GitHub Pages: Supabase Callback URL

Nach Discord OAuth muss der User ZURÜCK zu GitHub Pages geleitet werden:

- Supabase macht das automatisch via: `https://tiboriusdev.github.io/Grid-of-Glory/`
- ✅ Das sollte funktionieren — die URL ist oben bei Discord eingetragen

---

## 6️⃣ Testing

Nachdem alles konfiguriert ist:
1. Gehe zu: `https://tiboriusdev.github.io/Grid-of-Glory/`
2. Du solltest einen "Login"-Screen sehen
3. Klick "Mit Discord anmelden"
4. Erlauben → sollte dich zu GitHub Pages zurück bringen
5. Benutzername sollte oben angezeigt werden
6. ✅ Fertig!

---

## ⚠️ Falls es nicht funktioniert

### Problem: "Invalid redirect_uri"
**Lösung:** Discord Redirect URL ist nicht exakt gleich
- Gehe zu Discord App → Redirects
- Prüfe ob diese **exakt** eingetragen sind:
  ```
  https://xtoesokrqxwyzhaoyete.supabase.co/auth/v1/callback
  https://tiboriusdev.github.io/Grid-of-Glory
  https://tiboriusdev.github.io/Grid-of-Glory/
  ```

### Problem: "CORS error" beim Discord Login
**Lösung:** 
1. Gehe zu Supabase → **⚙️ Settings → API**
2. Scrolle nach unten — suche **"CORS Configuration"** oder **"Allowed origins"**
3. Wenn nicht sichtbar: **Ignorieren** — Supabase macht das automatisch
4. Falls du es findest: `https://tiboriusdev.github.io` hinzufügen

**Alternative (falls CORS nicht sichtbar):**
- Das ist normal in neuen Supabase Versionen
- Supabase erlaubt GitHub Pages automatisch
- Wenn es nicht funktioniert → Versuch Schritt 4️⃣ nochmal oder schreib mir

### Problem: "Cannot read property 'auth'"
**Lösung:** Supabase JS Library nicht geladen
- Prüf in `index.html`: 
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  ```
- Diese Zeile MUSS vor den anderen Scripts kommen

### Problem: Login funktioniert aber "Raum erstellen" schlägt fehl
**Lösung:** SQL Query für `user_teams` nicht ausgeführt
- Gehe zu Supabase → SQL Editor
- Prüf ob die Tabelle existiert: `SELECT * FROM user_teams;`
- Falls Fehler → SQL Query oben wieder ausführen

---

## 🚀 Fertig?

Nach erfolgreichem Login:
- Benutzername wird oben rechts angezeigt
- "Lokal spielen" funktioniert weiterhin
- "Online Multiplayer" funktioniert NUR wenn angemeldet
- Teams können gespeichert werden (DB-ready)

**Viel Erfolg! 🎮**

