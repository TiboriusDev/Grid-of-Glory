# Grid of Glory auf GitHub Pages — Deployment Guide

## 🚀 Aktueller Setup
- **GitHub Pages URL:** https://tiboriusdev.github.io/Grid-of-Glory/
- **Hosting:** Static Site (keine Build-Steps nötig)
- **Auth:** Supabase (Cloud)

---

## ✅ Was ist bereits konfiguriert

### Deine Supabase Keys
In `js/multiplayer.js` Zeile 7-8:
```javascript
const SUPABASE_URL = 'https://xtoesokrqxwyzhaoyete.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tlbHszjzDO717ybGhkJFyQ_vlIXOZc8';
```

⚠️ **Wichtig:** Das ist der **öffentliche Key** (`anon`), nicht der Secret Key!
- ✅ Sicher in Public Repositories (GitHub Pages braucht das)
- ❌ Niemals den Secret Key pushen!

---

## 📋 Checklist für GitHub Pages

- [ ] Repository ist öffentlich (für GitHub Pages)
- [ ] Branch `main` oder `gh-pages` wird deployed
- [ ] `index.html` liegt im Root oder `/docs` Ordner
- [ ] Settings → Pages → aktiviert für Branch `main` oder `gh-pages`

### Repo-Struktur (aktuelle Struktur ist OK):
```
Grid-of-Glory/
├── index.html         ← GitHub Pages startet hier
├── style.css
├── js/
│   ├── auth.js        ← Neu: Auth-Logik
│   ├── game.js
│   ├── multiplayer.js ← Supabase Config
│   └── ...
├── SUPABASE_SETUP.md  ← Neu: Setup-Anleitung
└── ...
```

---

## 🔐 Sicherheit

### Die Keys sind sicher, weil:
1. **anon key** ist öffentlich — darf in Public Code stehen
2. **Supabase Row Level Security** schützt die Daten:
   - Jeder Spieler kann nur seine eigenen Teams sehen
   - Datenbank-Policies erzwingen das

### Was solltest du NICHT pushen:
- Service Role Key (Secret)
- Discord Client Secret (brauchst du ja nur lokal für Setup)
- Datenbank-Passwörter

✅ **Dein aktueller Setup ist sicher!**

---

## 🧪 Lokales Testing vor GitHub Push

### 1. Test lokal:
```bash
# Öffne index.html mit Live Server
# (oder http://localhost:5500 in VS Code)
```

### 2. Teste alle Flows:
- ✅ Login mit Discord
- ✅ Login mit Email
- ✅ Logout
- ✅ Lokal spielen (ohne Auth)
- ✅ Online erstellen (mit Auth)
- ✅ Online beitreten (mit Auth)

### 3. Prüfe Developer Console:
```javascript
// In Browser Console:
console.log(currentUser);  // Should show user object
console.log(SUPABASE_URL); // Should show your Supabase URL
```

---

## 🚀 GitHub Push & Auto-Deploy

Wenn alles lokal funktioniert:

```bash
git add .
git commit -m "Add Discord + Email Auth with Supabase"
git push origin main
```

GitHub Pages deployed automatisch nach ~2 Min.

**Dann teste live:**
- Gehe zu: https://tiboriusdev.github.io/Grid-of-Glory/
- Login sollte funktionieren
- Discord OAuth sollte weiterleiten

---

## ⚠️ Falls auf GitHub nicht funktioniert

### 1. Überprüfe Discord Redirects
- Discord App → OAuth2 → Redirects
- Diese MÜSSEN eingetragen sein:
  ```
  https://xtoesokrqxwyzhaoyete.supabase.co/auth/v1/callback
  https://tiboriusdev.github.io/Grid-of-Glory
  https://tiboriusdev.github.io/Grid-of-Glory/
  ```

### 2. Prüfe Supabase CORS
- Supabase → Project Settings → API → CORS Configuration
- `https://tiboriusdev.github.io` muss eingetragen sein

### 3. Überprüfe GitHub Pages Einstellungen
- Repo → Settings → Pages
- Source: `Deploy from a branch`
- Branch: `main` (oder dein Branch)
- Folder: `/ (root)`

### 4. Warte auf Deploy
- Nach Push dauert es ~1-2 Min
- Prüfe unter "Deployments" rechts im Repo

---

## 📝 Tipps für Production

### Wenn du später domains expandierst:

```javascript
// Backup: Auch für localhost testen
// (falls du lokal weiterentwickeln möchtest)
```

In Discord App → einfach neue URLs hinzufügen:
- `http://localhost:3000`
- `http://localhost:5500`

---

## 🎯 Was jetzt zu tun ist

1. **Discord App erstellen** (falls noch nicht)
   - Folge: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) Punkt 1️⃣

2. **Supabase konfigurieren**
   - Folge: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) Punkte 2️⃣-4️⃣

3. **Lokal testen**
   - Öffne `index.html`
   - Login testen

4. **Push zu GitHub**
   - `git add . && git commit -m "Auth Setup" && git push`

5. **Live testen**
   - https://tiboriusdev.github.io/Grid-of-Glory/

---

**Fertig! Dein Spiel hat jetzt Cloud-Auth 🚀**
