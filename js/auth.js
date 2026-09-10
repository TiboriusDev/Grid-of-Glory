// ═══════════════════════════════════════════════════════
// AUTH.JS — Supabase Authentication für Grid of Glory
// Discord OAuth + Email/Passwort
// ═══════════════════════════════════════════════════════

let currentUser = null;

// ── SCREEN VERWALTUNG ──────────────────────────────────
function showAuthScreen() {
  hideAllScreens();
  document.getElementById('screen-auth').style.display = '';
  // Reset Form
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-loading').style.display = 'none';
}

function hideAuthScreen() {
  document.getElementById('screen-auth').style.display = 'none';
}

function showAuthLoading(show = true) {
  document.getElementById('auth-loading').style.display = show ? '' : 'none';
}

function showAuthError(message) {
  document.getElementById('auth-error').textContent = message;
}

// ── DISCORD LOGIN ──────────────────────────────────────
async function loginWithDiscord() {
  showAuthLoading(true);
  try {
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: 'https://tiboriusdev.github.io/Grid-of-Glory/'
      }
    });
    
    if (error) {
      showAuthError(`Discord-Fehler: ${error.message}`);
    }
  } catch (err) {
    showAuthError(`Fehler: ${err.message}`);
    showAuthLoading(false);
  }
}

// ── EMAIL REGISTRIERUNG ────────────────────────────────
async function signupEmail() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    showAuthError('Email und Passwort erforderlich');
    return;
  }

  if (password.length < 6) {
    showAuthError('Passwort muss mindestens 6 Zeichen lang sein');
    return;
  }

  showAuthLoading(true);
  showAuthError('');

  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    if (error) {
      showAuthError(`Registrierungsfehler: ${error.message}`);
      showAuthLoading(false);
      return;
    }

    // Erfolg
    showAuthError('');
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    showAuthMessage('✅ Konto erstellt! Du bist jetzt angemeldet.');
    
    // Nach kurzer Verzögerung zur Lobby
    setTimeout(() => {
      checkAuthStatus();
    }, 1000);

  } catch (err) {
    showAuthError(`Fehler: ${err.message}`);
    showAuthLoading(false);
  }
}

// ── EMAIL LOGIN ────────────────────────────────────────
async function loginEmail() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  if (!email || !password) {
    showAuthError('Email und Passwort erforderlich');
    return;
  }

  showAuthLoading(true);
  showAuthError('');

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      showAuthError(`Login-Fehler: ${error.message}`);
      showAuthLoading(false);
      return;
    }

    // Erfolg
    showAuthError('');
    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    checkAuthStatus();

  } catch (err) {
    showAuthError(`Fehler: ${err.message}`);
    showAuthLoading(false);
  }
}

// ── LOGOUT ─────────────────────────────────────────────
async function logout() {
  try {
    await sb.auth.signOut();
    currentUser = null;
    showAuthScreen();
  } catch (err) {
    console.error('Logout-Fehler:', err);
  }
}

function showAuthMessage(msg) {
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = msg;
  errorEl.style.color = '#4ade80';
  setTimeout(() => {
    errorEl.style.color = 'var(--red-light)';
  }, 3000);
}

// ── AUTH STATUS CHECK ──────────────────────────────────
async function checkAuthStatus() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    
    if (session?.user) {
      currentUser = session.user;
      hideAuthScreen();
      updateUserDisplay();
      
      // 🔄 Versuche ins aktives Spiel zurück zu kehren (falls vorhanden)
      // // await reconnectToActiveGame();
      
      // Falls kein aktives Spiel: Zur Lobby
      if (!document.getElementById('screen-lobby').style.display) {
        showLobby();
      }
      console.log('✅ Angemeldet als:', currentUser.email || currentUser.user_metadata?.name);
    } else {
      currentUser = null;
      showAuthScreen();
    }
  } catch (err) {
    console.error('Auth-Check-Fehler:', err);
    showAuthScreen();
  }
}

// ── USER INFO ANZEIGEN ─────────────────────────────────
function updateUserDisplay() {
  if (!currentUser) return;

  const userName = currentUser.user_metadata?.name || 
                   currentUser.email || 
                   'Spieler';
  
  const userDisplay = document.getElementById('user-display');
  if (userDisplay) {
    userDisplay.innerHTML = `👤 ${userName}`;
  }
}

// ── SESSION LISTENER (Auto-Redirect) ───────────────────
// Wird aufgerufen wenn User sich anmeldet/abmeldet
sb.auth.onAuthStateChange(async (event, session) => {
  console.log('🔐 Auth Event:', event);
  
  if (event === 'SIGNED_IN') {
    currentUser = session.user;
    hideAuthScreen();
    updateUserDisplay();
    
    // 🔄 Versuche ins aktives Spiel zurück zu kehren (falls vorhanden)
    // await reconnectToActiveGame();
    
    // Falls kein aktives Spiel: Zur Lobby
    if (!document.getElementById('screen-lobby').style.display) {
      showLobby();
    }
  } else if (event === 'SIGNED_OUT') {
    currentUser = null;
    showAuthScreen();
  } else if (event === 'USER_UPDATED') {
    currentUser = session.user;
    updateUserDisplay();
  }
});

// ── TEAM SPEICHERN ────────────────────────────────────
async function saveTeam(teamName, factionA, factionB, units) {
  if (!currentUser) {
    alert('Du musst angemeldet sein um ein Team zu speichern!');
    return false;
  }

  try {
    const { data, error } = await sb.from('user_teams').insert({
      user_id: currentUser.id,
      team_name: teamName,
      faction_a: factionA,
      units: JSON.stringify(units)
    }).select();

    if (error) {
      console.error('Team-Speicher-Fehler:', error);
      alert(`Fehler beim Speichern: ${error.message}`);
      return false;
    }

    console.log('✅ Team gespeichert:', data);
    return true;
  } catch (err) {
    console.error('Fehler:', err);
    return false;
  }
}

// ── TEAMS LADEN ────────────────────────────────────────
async function loadTeams() {
  if (!currentUser) return [];

  try {
    const { data, error } = await sb
      .from('user_teams')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Teams-Lade-Fehler:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Fehler beim Laden der Teams:', err);
    return [];
  }
}

// ── INIT: Beim Laden der Seite ─────────────────────────
window.addEventListener('load', () => {
  console.log('🚀 Auth-System wird initialisiert...');
  checkAuthStatus();
});
