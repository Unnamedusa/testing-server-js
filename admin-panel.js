// ═══════════════════════════════════════════
// SCP-079 — ADMIN PANEL (FILE-BASED)
// Works WITHOUT the server running.
// Directly reads/writes JSON files on disk.
// ═══════════════════════════════════════════

const readline = require("readline");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;
const TOKENS_FILE = path.join(DIR, "tokens.json");
const SESSIONS_FILE = path.join(DIR, "sessions.json");
const PASSWORD_FILE = path.join(DIR, "password.json");
const ADMIN_FILE = path.join(DIR, "admin.json");
const HONEYPOT_LOG = path.join(DIR, "honeypot.log");
const STATE_FILE = path.join(DIR, "state.json");

function loadJ(f) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {} return {}; }
function saveJ(f, d) { fs.writeFileSync(f, JSON.stringify(d, null, 2), "utf8"); }

// Same fractal hash as server.js — must match exactly
function fractalHash(input, depth) {
  depth = depth || 7;
  let h = crypto.createHash("sha512").update(input).digest("hex");
  for (let i = 0; i < depth; i++) {
    const mid = Math.floor(h.length / 2);
    const L = h.substring(0, mid), R = h.substring(mid);
    const mirror = crypto.createHash("sha256").update(R + L).digest("hex");
    let xor = "";
    for (let j = 0; j < 64; j++) xor += (parseInt(h[j], 16) ^ parseInt(mirror[j % mirror.length], 16)).toString(16);
    h = crypto.createHash("sha512").update(h + mirror + xor + String(i * 137)).digest("hex");
  }
  return h;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function menu() {
  console.clear();
  console.log("");
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║       SCP-079 — ADMIN PANEL (OFFLINE)         ║");
  console.log("║       Edits files directly. No server needed.  ║");
  console.log("╠═══════════════════════════════════════════════╣");
  console.log("║                                               ║");
  console.log("║   1. Change master password                   ║");
  console.log("║   2. Generate access token                    ║");
  console.log("║   3. List tokens                              ║");
  console.log("║   4. Revoke token                             ║");
  console.log("║   5. Kill all sessions                        ║");
  console.log("║   6. View honeypot log                        ║");
  console.log("║   7. System status                            ║");
  console.log("║   8. Set admin IP                             ║");
  console.log("║   9. Wipe all data (factory reset)            ║");
  console.log("║   0. Exit                                     ║");
  console.log("║                                               ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log("");

  const c = (await ask("  Select: ")).trim();

  switch (c) {
    case "1": await changePassword(); break;
    case "2": await genToken(); break;
    case "3": listTokens(); break;
    case "4": await revokeToken(); break;
    case "5": await killSessions(); break;
    case "6": viewHoneypot(); break;
    case "7": systemStatus(); break;
    case "8": await setAdminIP(); break;
    case "9": await factoryReset(); break;
    case "0":
      console.log("\n  Bye.\n");
      rl.close();
      process.exit(0);
    default: console.log("\n  Invalid option.");
  }

  await ask("\n  Press ENTER to continue...");
  await menu();
}

// ═══ 1. PASSWORD ═══
async function changePassword() {
  console.log("\n  ═══ CHANGE MASTER PASSWORD ═══\n");
  const cur = loadJ(PASSWORD_FILE);
  if (cur.set) console.log("  Last changed: " + cur.set);
  else console.log("  No password set yet.");

  const pw = await ask("\n  New password: ");
  if (!pw || pw.length < 4) { console.log("  ✗ Too short (min 4)"); return; }
  const confirm = await ask("  Confirm: ");
  if (pw !== confirm) { console.log("  ✗ Do not match"); return; }

  saveJ(PASSWORD_FILE, { hash: fractalHash(pw, 5), set: new Date().toISOString() });
  saveJ(SESSIONS_FILE, {});

  console.log("\n  ✓ PASSWORD CHANGED");
  console.log("  ✓ All sessions killed — everyone must log in again");
  console.log("  ✓ Takes effect immediately, even if server is running");
}

// ═══ 2. GEN TOKEN ═══
async function genToken() {
  console.log("\n  ═══ GENERATE ACCESS TOKEN ═══\n");
  const user = await ask("  Username: ");
  if (!user) { console.log("  ✗ Username required"); return; }
  const level = (await ask("  Clearance LEVEL-1/2/3/4/5 [LEVEL-3]: ")).trim() || "LEVEL-3";

  const tok = loadJ(TOKENS_FILE);
  const raw = "scp079-" + crypto.randomBytes(24).toString("hex");
  tok[user] = { hash: fractalHash(raw, 5), created: new Date().toISOString(), active: true, clearance: level };
  saveJ(TOKENS_FILE, tok);

  console.log("\n  ╔════════════════════════════════════════╗");
  console.log("  ║  TOKEN GENERATED                       ║");
  console.log("  ╠════════════════════════════════════════╣");
  console.log("    User:      " + user);
  console.log("    Clearance: " + level);
  console.log("    Token:     " + raw);
  console.log("  ║                                        ║");
  console.log("  ║  ⚠ SAVE THIS — SHOWN ONLY ONCE        ║");
  console.log("  ╚════════════════════════════════════════╝");
}

// ═══ 3. LIST ═══
function listTokens() {
  console.log("\n  ═══ TOKEN LIST ═══\n");
  const tok = loadJ(TOKENS_FILE);
  const entries = Object.entries(tok);
  if (!entries.length) { console.log("  No tokens."); return; }
  for (const [u, i] of entries) {
    console.log(`  ${i.active ? "✓" : "✗"} ${u.padEnd(20)} [${i.clearance}]  ${i.created}${i.active ? "" : "  REVOKED"}`);
  }
  console.log(`\n  Total: ${entries.length} | Active: ${entries.filter(([,i]) => i.active).length}`);
}

// ═══ 4. REVOKE ═══
async function revokeToken() {
  console.log("\n  ═══ REVOKE TOKEN ═══\n");
  listTokens();
  const user = await ask("\n  Username to revoke: ");
  if (!user) return;
  const tok = loadJ(TOKENS_FILE);
  if (tok[user]) {
    tok[user].active = false;
    saveJ(TOKENS_FILE, tok);
    const sess = loadJ(SESSIONS_FILE);
    let k = 0;
    for (const id in sess) { if (sess[id].user === user) { delete sess[id]; k++; } }
    saveJ(SESSIONS_FILE, sess);
    console.log("  ✓ Revoked: " + user + (k ? ` (${k} session(s) killed)` : ""));
  } else {
    console.log("  ✗ Not found: " + user);
  }
}

// ═══ 5. KILL SESSIONS ═══
async function killSessions() {
  console.log("\n  ═══ KILL ALL SESSIONS ═══\n");
  const sess = loadJ(SESSIONS_FILE);
  const n = Object.keys(sess).length;
  console.log("  Sessions: " + n);
  if (!n) { console.log("  Nothing to kill."); return; }
  const c = await ask("  Kill all? (y/n): ");
  if (c.toLowerCase() !== "y") return;
  saveJ(SESSIONS_FILE, {});
  console.log("  ✓ " + n + " sessions destroyed.");
}

// ═══ 6. HONEYPOT ═══
function viewHoneypot() {
  console.log("\n  ═══ HONEYPOT LOG ═══\n");
  if (!fs.existsSync(HONEYPOT_LOG)) { console.log("  Clean. No intrusions."); return; }
  const log = fs.readFileSync(HONEYPOT_LOG, "utf8").trim();
  if (!log) { console.log("  Clean. No intrusions."); return; }
  const lines = log.split("\n");
  console.log(`  ${lines.length} intrusion(s):\n`);
  lines.slice(-25).forEach(l => console.log("  " + l));
  if (lines.length > 25) console.log(`\n  ... last 25 of ${lines.length}`);
}

// ═══ 7. STATUS ═══
function systemStatus() {
  console.log("\n  ═══ SYSTEM STATUS ═══\n");
  const pw = loadJ(PASSWORD_FILE);
  console.log("  Password:   " + (pw.hash ? "✓ SET (" + pw.set + ")" : "✗ NOT SET"));
  const tok = loadJ(TOKENS_FILE);
  const te = Object.entries(tok);
  console.log("  Tokens:     " + te.filter(([,i]) => i.active).length + " active / " + te.length + " total");
  const sess = loadJ(SESSIONS_FILE);
  const now = Date.now();
  console.log("  Sessions:   " + Object.values(sess).filter(s => s.expires > now).length + " active");
  const adm = loadJ(ADMIN_FILE);
  console.log("  Admin IP:   " + (adm.ip || "NOT SET"));
  if (fs.existsSync(HONEYPOT_LOG)) {
    const l = fs.readFileSync(HONEYPOT_LOG, "utf8").trim().split("\n").filter(l => l);
    console.log("  Honeypot:   " + l.length + " intrusion(s)");
  } else console.log("  Honeypot:   clean");
  if (fs.existsSync(STATE_FILE)) console.log("  State:      " + (fs.statSync(STATE_FILE).size / 1024).toFixed(1) + " KB");
  else console.log("  State:      none");
  console.log("\n  Files:");
  [TOKENS_FILE, SESSIONS_FILE, PASSWORD_FILE, ADMIN_FILE, HONEYPOT_LOG, STATE_FILE].forEach(f => {
    const n = path.basename(f), ex = fs.existsSync(f);
    console.log("    " + (ex ? "✓" : "·") + " " + n + (ex ? " (" + (fs.statSync(f).size / 1024).toFixed(1) + " KB)" : ""));
  });
}

// ═══ 8. ADMIN IP ═══
async function setAdminIP() {
  console.log("\n  ═══ SET ADMIN IP ═══\n");
  const adm = loadJ(ADMIN_FILE);
  if (adm.ip) console.log("  Current: " + adm.ip);
  const ip = await ask("\n  New IP (or 'localhost'): ");
  if (!ip) return;
  saveJ(ADMIN_FILE, { ip: ip.trim() === "localhost" ? "127.0.0.1" : ip.trim(), set: new Date().toISOString() });
  console.log("  ✓ Done");
}

// ═══ 9. FACTORY RESET ═══
async function factoryReset() {
  console.log("\n  ═══ FACTORY RESET ═══\n");
  console.log("  ⚠ DELETES: tokens, sessions, password, admin IP, honeypot log, state");
  const c = await ask("\n  Type 'RESET' to confirm: ");
  if (c !== "RESET") { console.log("  Cancelled."); return; }
  [TOKENS_FILE, SESSIONS_FILE, PASSWORD_FILE, ADMIN_FILE, HONEYPOT_LOG, STATE_FILE].forEach(f => {
    if (fs.existsSync(f)) { fs.unlinkSync(f); console.log("  ✓ Deleted " + path.basename(f)); }
  });
  console.log("\n  ✓ FACTORY RESET COMPLETE");
  console.log("  ✓ Restart server to generate new default password");
}

menu().catch(e => { console.error(e); process.exit(1); });
