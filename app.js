/* ================= Runic alphabet ================= */
var RUNES = {
  A:'𐔀', B:'ᛒ', C:'Ͼ', D:'◈', E:'ᛖ', F:'ᚠ', G:'ᛜ', H:'ᚺ', I:'ᛁ', J:'ᛃ',
  K:'ᚲ', L:'ᛚ', M:'ᛗ', N:'ᚾ', O:'◇', P:'ᛈ', Q:'Ϙ', R:'ᚱ', S:'ᛋ', T:'ᛏ',
  U:'ᚢ', V:'ᚡ', W:'ᚹ', X:'ᛪ', Y:'ᛦ', Z:'ᛉ'
};
function toRunes(text){
  var out = '';
  for (var i=0;i<text.length;i++){
    var ch = text[i].toUpperCase();
    out += RUNES[ch] !== undefined ? RUNES[ch] : text[i];
  }
  return out;
}

/* ================= Mission pool ================= */
var MISSION_POOL = [
  // Roblox
  {game:'Roblox', title:'Sessione ad Adopt Me', desc:'Gioca a Roblox per 30 minuti in Adopt Me e prenditi cura di un cucciolo raro.', xp:40},
  {game:'Roblox', title:'Architetto segreto', desc:'Costruisci una stanza segreta in un gioco a tua scelta su Roblox.', xp:60},
  {game:'Roblox', title:'Livello 10 a Blox Fruits', desc:'Raggiungi il livello 10 in Blox Fruits senza abbandonare la partita.', xp:90},
  {game:'Roblox', title:'Vittoria a Bedwars', desc:'Vinci una partita a Roblox Bedwars proteggendo il tuo letto fino alla fine.', xp:70},
  {game:'Roblox', title:'Fortuna al Pet Simulator', desc:'Guadagna 500 monete nel gioco Pet Simulator e sblocca un nuovo animale.', xp:80},
  {game:'Roblox', title:'Corsa senza cadute', desc:'Completa una run intera senza morire in Tower of Hell.', xp:100},
  // Minecraft
  {game:'Minecraft', title:'La prima dimora', desc:'Costruisci una casa con almeno 3 stanze e un tetto degno di un nobile.', xp:50},
  {game:'Minecraft', title:'Il drago cade', desc:'Sconfiggi lEnder Dragon e porta le sue spoglie alla gilda.', xp:150},
  {game:'Minecraft', title:'Armatura di diamante', desc:'Trova diamanti e forgia unarmatura completa prima del tramonto.', xp:90},
  {game:'Minecraft', title:'Cinque notti da incubo', desc:'Sopravvivi 5 notti in modalita hardcore senza perdere la vita.', xp:120},
  {game:'Minecraft', title:'Stalla e cavallo', desc:'Doma un cavallo selvaggio e costruisci per lui una stalla sicura.', xp:45},
  {game:'Minecraft', title:'Oltre il portale', desc:'Costruisci un portale per il Nether ed esplora una fortezza abbandonata.', xp:100},
  // Rocket League
  {game:'Rocket League', title:'Tripletta classificata', desc:'Vinci 3 partite classificate consecutive senza arrenderti.', xp:90},
  {game:'Rocket League', title:'Gol acrobatico', desc:'Segna un gol aereo spettacolare in una partita ufficiale.', xp:60},
  {game:'Rocket League', title:'Cinque vittorie in Duo', desc:'Vinci 5 partite in modalita Duo insieme a un compagno di squadra.', xp:100},
  {game:'Rocket League', title:'Rango Platino', desc:'Raggiungi il rango Platino o superiore nella stagione in corso.', xp:130},
  {game:'Rocket League', title:'Parata decisiva', desc:'Fai un salvataggio decisivo negli ultimi 10 secondi di una partita.', xp:70},
  {game:'Rocket League', title:'Dieci vittorie settimanali', desc:'Vinci 10 partite in totale nellarco di questa settimana.', xp:150}
];

/* ================= Ranks & XP curve ================= */
var RANKS = [
  'Novizio', 'Apprendista', 'Cercatore', 'Cacciatore di Taglie', 'Avventuriero',
  'Veterano', 'Eroe', 'Campione della Gilda', 'Leggenda', 'Mito Vivente'
];
function rankName(level){
  var idx = Math.min(level - 1, RANKS.length - 1);
  return RANKS[idx];
}
function xpNeededForLevel(level){
  // XP required to go from `level` to `level+1` — grows each time
  return Math.round(100 * Math.pow(1.35, level - 1));
}
function levelFromTotalXP(totalXP){
  var level = 1, remaining = totalXP;
  while (remaining >= xpNeededForLevel(level)){
    remaining -= xpNeededForLevel(level);
    level++;
  }
  return {level: level, xpIntoLevel: remaining, xpForNext: xpNeededForLevel(level)};
}

/* ================= Storage helpers ================= */
var storageOK = (typeof window.storage !== 'undefined');
async function storeGet(key, shared){
  if (!storageOK) return null;
  try{
    var r = await window.storage.get(key, !!shared);
    return r ? r.value : null;
  }catch(e){ return null; }
}
async function storeSet(key, value, shared){
  if (!storageOK) return false;
  try{
    await window.storage.set(key, value, !!shared);
    return true;
  }catch(e){ return false; }
}

/* ================= App state ================= */
var state = {
  user: null,           // {email, name, totalXP, activeMissionIds:[], completedMissionIds:[], createdAt}
  board: null,          // {generatedAt, missions:[{id, game, title, desc, xp}]}
  currentTab: 'board'
};
var EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

function uid(prefix){
  return prefix + '_' + Math.random().toString(36).slice(2, 10);
}

/* ================= Board generation ================= */
function pickRandomMissions(count){
  var pool = MISSION_POOL.slice();
  var picked = [];
  while (picked.length < count && pool.length){
    var idx = Math.floor(Math.random() * pool.length);
    var m = pool.splice(idx, 1)[0];
    picked.push(Object.assign({id: uid('m')}, m));
  }
  return picked;
}

async function loadOrCreateBoard(){
  var raw = await storeGet('board:v1', true);
  var now = Date.now();
  if (raw){
    try{
      var parsed = JSON.parse(raw);
      if (parsed && parsed.generatedAt && (now - parsed.generatedAt) < EIGHT_HOURS_MS){
        return parsed;
      }
    }catch(e){ /* fall through to regenerate */ }
  }
  var fresh = {generatedAt: now, missions: pickRandomMissions(6)};
  await storeSet('board:v1', JSON.stringify(fresh), true);
  return fresh;
}

/* ================= Account helpers ================= */
function accountKey(email){
  return 'account:' + email.trim().toLowerCase().replace(/[^a-z0-9._%+-]/g, '_');
}
async function loadAccount(email){
  var raw = await storeGet(accountKey(email), true);
  if (!raw) return null;
  try{ return JSON.parse(raw); }catch(e){ return null; }
}
async function saveAccount(acc){
  await storeSet(accountKey(acc.email), JSON.stringify(acc), true);
}
function simpleHash(str){
  // Not real security — just a light obfuscation for this demo guild app.
  var h = 0;
  for (var i=0;i<str.length;i++){ h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
  return String(h);
}

/* ================= Toasts ================= */
function showToast(msg){
  var wrap = document.getElementById('toast-wrap');
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(function(){ el.remove(); }, 3600);
}

/* ================= Rendering ================= */
function renderUserbar(){
  var info = levelFromTotalXP(state.user.totalXP);
  document.getElementById('ub-name').textContent = state.user.name;
  document.getElementById('ub-rank').textContent = 'Rango: ' + rankName(info.level) + ' (Lv. ' + info.level + ')';
  var pct = Math.max(4, Math.round((info.xpIntoLevel / info.xpForNext) * 100));
  document.getElementById('ub-xpfill').style.width = pct + '%';
  document.getElementById('ub-xplabel').textContent = info.xpIntoLevel + ' / ' + info.xpForNext + ' PE';
}

function renderBoard(){
  var grid = document.getElementById('scroll-grid');
  grid.innerHTML = '';
  if (!state.board.missions.length){
    grid.innerHTML = '<div class="empty-note">La bacheca è vuota per ora. Torna più tardi.</div>';
    return;
  }
  var nextReset = new Date(state.board.generatedAt + EIGHT_HOURS_MS);
  document.getElementById('reset-info').textContent =
    'Prossimo rinnovo della bacheca: ' + nextReset.toLocaleString('it-IT', {hour:'2-digit', minute:'2-digit', day:'2-digit', month:'2-digit'});

  state.board.missions.forEach(function(m){
    var card = document.createElement('div');
    card.className = 'scroll-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', 'Incarico misterioso, clicca per tradurlo');
    var already = state.user.activeMissionIds.indexOf(m.id) !== -1;
    var completedCount = state.user.completedMissionIds.filter(function(x){return x===m.id;}).length;
    card.innerHTML =
      '<div class="scroll-tag">' + m.game + '</div>' +
      '<div class="rune-text">' + toRunes(m.title) + '</div>' +
      '<div class="scroll-xp">Ricompensa stimata: ' + m.xp + ' PE</div>' +
      (already ? '<div class="scroll-status">Già accettato</div>' : '') +
      (completedCount ? '<div class="scroll-status">Completato ' + completedCount + '× in passato</div>' : '');
    card.addEventListener('click', function(){ openMissionModal(m); });
    card.addEventListener('keydown', function(e){ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); openMissionModal(m); } });
    grid.appendChild(card);
  });
}

function renderActive(){
  var list = document.getElementById('active-list');
  list.innerHTML = '';
  var activeMissions = state.user.activeMissionIds
    .map(function(id){ return state.board.missions.find(function(m){ return m.id === id; }) || findInPoolById(id); })
    .filter(Boolean);
  if (!activeMissions.length){
    list.innerHTML = '<div class="empty-note">Nessun incarico in corso. Vai alla bacheca e accettane uno.</div>';
    return;
  }
  activeMissions.forEach(function(m){
    var row = document.createElement('div');
    row.className = 'active-row';
    row.innerHTML =
      '<div class="info"><span class="tag-pill">' + m.game + '</span><h3>' + escapeHTML(m.title) + '</h3><p>' + escapeHTML(m.desc) + '</p></div>' +
      '<div class="actions">' +
        '<button class="btn btn-ok" data-action="complete" data-id="' + m.id + '">Segna come completato</button>' +
        '<button class="btn btn-danger" data-action="abandon" data-id="' + m.id + '">Abbandona</button>' +
      '</div>';
    list.appendChild(row);
  });
  list.querySelectorAll('[data-action="complete"]').forEach(function(btn){
    btn.addEventListener('click', function(){ completeMission(btn.getAttribute('data-id')); });
  });
  list.querySelectorAll('[data-action="abandon"]').forEach(function(btn){
    btn.addEventListener('click', function(){ abandonMission(btn.getAttribute('data-id')); });
  });
}

function findInPoolById(id){
  // Missions accepted from a since-rotated board may no longer be on state.board;
  // fall back to a generic record kept on the user object itself.
  var rec = (state.user.missionArchive || {})[id];
  return rec || null;
}

function renderDone(){
  var list = document.getElementById('done-list');
  list.innerHTML = '';
  if (!state.user.completedLog || !state.user.completedLog.length){
    list.innerHTML = '<div class="empty-note">Nessun incarico portato a termine, per ora.</div>';
    return;
  }
  state.user.completedLog.slice().reverse().forEach(function(entry){
    var row = document.createElement('div');
    row.className = 'active-row';
    row.innerHTML =
      '<div class="info"><span class="tag-pill">' + entry.game + '</span><h3>' + escapeHTML(entry.title) + '</h3>' +
      '<p>+' + entry.xp + ' PE — ' + new Date(entry.when).toLocaleDateString('it-IT') + '</p></div>';
    list.appendChild(row);
  });
}

function escapeHTML(s){
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderAll(){
  renderUserbar();
  renderBoard();
  renderActive();
  renderDone();
}

/* ================= Mission modal ================= */
function openMissionModal(mission){
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  var already = state.user.activeMissionIds.indexOf(mission.id) !== -1;
  backdrop.innerHTML =
    '<div class="modal">' +
      '<div class="rune-line">' + toRunes(mission.title) + '</div>' +
      '<h3>' + escapeHTML(mission.title) + '</h3>' +
      '<p class="desc">' + escapeHTML(mission.desc) + '</p>' +
      '<div class="xp-line">Gioco: ' + mission.game + ' · Ricompensa: ' + mission.xp + ' PE</div>' +
      '<div class="modal-actions">' +
        (already
          ? '<button class="btn btn-solid" data-close="1">Chiudi</button>'
          : '<button class="btn btn-danger" data-act="reject">Rifiuta</button><button class="btn btn-ok" data-act="accept">Accetta</button>') +
      '</div>' +
    '</div>';
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', function(e){ if (e.target === backdrop) backdrop.remove(); });
  var closeBtn = backdrop.querySelector('[data-close]');
  if (closeBtn) closeBtn.addEventListener('click', function(){ backdrop.remove(); });
  var acceptBtn = backdrop.querySelector('[data-act="accept"]');
  var rejectBtn = backdrop.querySelector('[data-act="reject"]');
  if (acceptBtn) acceptBtn.addEventListener('click', function(){ acceptMission(mission); backdrop.remove(); });
  if (rejectBtn) rejectBtn.addEventListener('click', function(){ backdrop.remove(); showToast('Incarico rifiutato.'); });
}

async function acceptMission(mission){
  if (state.user.activeMissionIds.indexOf(mission.id) !== -1) return;
  state.user.activeMissionIds.push(mission.id);
  state.user.missionArchive = state.user.missionArchive || {};
  state.user.missionArchive[mission.id] = mission;
  await saveAccount(state.user);
  renderAll();
  showToast('Incarico accettato: ' + mission.title);
}

async function abandonMission(id){
  var idx = state.user.activeMissionIds.indexOf(id);
  if (idx !== -1) state.user.activeMissionIds.splice(idx, 1);
  await saveAccount(state.user);
  renderAll();
  showToast('Incarico abbandonato.');
}

async function completeMission(id){
  var mission = state.board.missions.find(function(m){ return m.id === id; }) || findInPoolById(id);
  if (!mission) return;
  var idx = state.user.activeMissionIds.indexOf(id);
  if (idx !== -1) state.user.activeMissionIds.splice(idx, 1);

  var beforeLevel = levelFromTotalXP(state.user.totalXP).level;
  state.user.totalXP += mission.xp;
  var afterInfo = levelFromTotalXP(state.user.totalXP);

  state.user.completedMissionIds.push(id);
  state.user.completedLog = state.user.completedLog || [];
  state.user.completedLog.push({title: mission.title, game: mission.game, xp: mission.xp, when: Date.now()});

  await saveAccount(state.user);
  renderAll();
  showToast('Incarico completato! +' + mission.xp + ' PE');
  if (afterInfo.level > beforeLevel){
    setTimeout(function(){
      showToast('Sei salito di grado! Ora sei ' + rankName(afterInfo.level) + ' (Lv. ' + afterInfo.level + ')');
    }, 350);
  }
}

/* ================= Tabs ================= */
function setupTabs(){
  document.querySelectorAll('.tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      var name = tab.getAttribute('data-tab');
      document.getElementById('tab-board').classList.toggle('hidden', name !== 'board');
      document.getElementById('tab-active').classList.toggle('hidden', name !== 'active');
      document.getElementById('tab-done').classList.toggle('hidden', name !== 'done');
    });
  });
}

/* ================= Receptionist animation ================= */
var quotes = [
  '"Benvenuto. La bacheca ti aspetta."',
  '"Ogni pergamena nasconde unavventura."',
  '"Torna quando avrai completato un incarico."',
  '"La gilda è fiera di te, avventuriero."',
  '"Attento alle missioni più ambiziose."'
];
function scheduleBlink(){
  var delay = 2600 + Math.random() * 4200;
  setTimeout(function(){
    var l = document.getElementById('eyelid-left');
    var r = document.getElementById('eyelid-right');
    if (l && r){
      l.classList.remove('blink'); r.classList.remove('blink');
      void l.offsetWidth;
      l.classList.add('blink'); r.classList.add('blink');
    }
    scheduleBlink();
  }, delay);
}
function setupReceptionist(){
  var frame = document.getElementById('receptionist-frame');
  var quoteEl = document.getElementById('receptionist-quote');
  function greet(){
    frame.classList.remove('glow');
    void frame.offsetWidth;
    frame.classList.add('glow');
    var heart = document.createElement('div');
    heart.className = 'heart-pop';
    heart.textContent = '🫶';
    frame.appendChild(heart);
    setTimeout(function(){ heart.remove(); }, 1150);
    quoteEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
  }
  frame.addEventListener('click', greet);
  frame.addEventListener('keydown', function(e){ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); greet(); } });
  scheduleBlink();
}

/* ================= Auth flow ================= */
function setupAuthTabs(){
  document.querySelectorAll('.auth-tab').forEach(function(tab){
    tab.addEventListener('click', function(){
      document.querySelectorAll('.auth-tab').forEach(function(t){ t.classList.remove('active'); });
      tab.classList.add('active');
      var mode = tab.getAttribute('data-mode');
      document.getElementById('login-form').classList.toggle('hidden', mode !== 'login');
      document.getElementById('register-form').classList.toggle('hidden', mode !== 'register');
    });
  });
}

async function enterApp(user){
  state.user = user;
  state.board = await loadOrCreateBoard();
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  renderAll();
  setupReceptionist();
  await storeSet('session:lastemail', user.email, false);
}

async function handleLogin(){
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  var errEl = document.getElementById('login-error');
  errEl.textContent = '';
  if (!email || !pass){ errEl.textContent = 'Inserisci email e password.'; return; }
  var acc = await loadAccount(email);
  if (!acc){ errEl.textContent = 'Nessun account trovato con questa email.'; return; }
  if (acc.passHash !== simpleHash(pass)){ errEl.textContent = 'Password errata.'; return; }
  ensureAccountShape(acc);
  await enterApp(acc);
}

async function handleRegister(){
  var name = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var pass = document.getElementById('reg-pass').value;
  var errEl = document.getElementById('register-error');
  errEl.textContent = '';
  if (!name || !email || !pass){ errEl.textContent = 'Compila tutti i campi.'; return; }
  if (pass.length < 4){ errEl.textContent = 'La password deve avere almeno 4 caratteri.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ errEl.textContent = 'Email non valida.'; return; }
  var existing = await loadAccount(email);
  if (existing){ errEl.textContent = 'Esiste già un account con questa email. Accedi invece.'; return; }
  var acc = {
    email: email.toLowerCase(),
    name: name,
    passHash: simpleHash(pass),
    totalXP: 0,
    activeMissionIds: [],
    completedMissionIds: [],
    completedLog: [],
    missionArchive: {},
    createdAt: Date.now()
  };
  await saveAccount(acc);
  await enterApp(acc);
}

function ensureAccountShape(acc){
  if (!acc.activeMissionIds) acc.activeMissionIds = [];
  if (!acc.completedMissionIds) acc.completedMissionIds = [];
  if (!acc.completedLog) acc.completedLog = [];
  if (!acc.missionArchive) acc.missionArchive = {};
  if (typeof acc.totalXP !== 'number') acc.totalXP = 0;
}

function handleLogout(){
  state.user = null;
  state.board = null;
  document.getElementById('main-screen').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('login-pass').value = '';
}

/* ================= Init ================= */
window.addEventListener('DOMContentLoaded', async function(){
  setupAuthTabs();
  setupTabs();
  document.getElementById('login-submit').addEventListener('click', handleLogin);
  document.getElementById('register-submit').addEventListener('click', handleRegister);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  ['login-email','login-pass'].forEach(function(id){
    document.getElementById(id).addEventListener('keydown', function(e){ if (e.key==='Enter') handleLogin(); });
  });
  ['reg-name','reg-email','reg-pass'].forEach(function(id){
    document.getElementById(id).addEventListener('keydown', function(e){ if (e.key==='Enter') handleRegister(); });
  });

  var lastEmail = await storeGet('session:lastemail', false);
  if (lastEmail){
    document.getElementById('login-email').value = lastEmail;
  }
});
