const express = require("express");
const Anthropic = require("@anthropic-ai/sdk").default;
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const { execSync, spawn } = require("child_process");

const app = express();
app.use(express.json({ limit: "2mb" }));

const DIR = __dirname;
const TOKENS_FILE = path.join(DIR, "tokens.json");
const SESSIONS_FILE = path.join(DIR, "sessions.json");
const PASSWORD_FILE = path.join(DIR, "password.json");
const ADMIN_FILE = path.join(DIR, "admin.json");
const HONEYPOT_LOG = path.join(DIR, "honeypot.log");
const STATE_FILE = path.join(DIR, "state.json");

function loadJ(f) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {} return {}; }
function saveJ(f, d) { try { fs.writeFileSync(f, JSON.stringify(d, null, 2), "utf8"); } catch (e) {} }

// ═══════════════════════════════════════════
// FRACTAL HASH + ENCRYPTION + COMPRESSION
// ═══════════════════════════════════════════

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

function qState() {
  const qs = [];
  for (let i = 0; i < 8; i++) { const a = Math.random(); qs.push({ q: i, a: +a.toFixed(6), b: +Math.sqrt(1 - a * a).toFixed(6), ph: +(Math.random() * Math.PI * 2).toFixed(6), basis: Math.random() > .5 ? "Z" : "X" }); }
  return { protocol: "BB84-SCP", bell: ["Φ+", "Φ-", "Ψ+", "Ψ-"][Math.floor(Math.random() * 4)], eid: crypto.randomBytes(8).toString("hex"), coherence: +(0.87 + Math.random() * .13).toFixed(6), qubits: qs };
}

function fractalCompress(data, maxBytes) {
  maxBytes = maxBytes || 512000;
  const json = typeof data === "string" ? data : JSON.stringify(data);
  let buf = zlib.deflateSync(Buffer.from(json, "utf8"), { level: 9 });
  const chunks = Math.min(16, Math.ceil(buf.length / 1024));
  const chunkSize = Math.ceil(buf.length / chunks);
  const folded = [];
  for (let i = 0; i < chunks; i++) { const s = buf.slice(i * chunkSize, (i + 1) * chunkSize); folded.push(i % 2 === 0 ? s : Buffer.from([...s].reverse())); }
  let fb = zlib.deflateSync(Buffer.concat(folded), { level: 9 });
  if (fb.length > maxBytes) fb = fb.slice(0, maxBytes);
  return { _fc: true, v: 5, chunks, origSize: json.length, compSize: fb.length, ratio: (fb.length / json.length).toFixed(4), data: fb.toString("base64") };
}

function fractalDecompress(p) {
  if (!p || !p._fc) return p;
  let buf = Buffer.from(p.data, "base64");
  buf = zlib.inflateSync(buf);
  const cs = Math.ceil(buf.length / p.chunks);
  const u = [];
  for (let i = 0; i < p.chunks; i++) { const s = buf.slice(i * cs, (i + 1) * cs); u.push(i % 2 === 0 ? s : Buffer.from([...s].reverse())); }
  return JSON.parse(zlib.inflateSync(Buffer.concat(u)).toString("utf8"));
}

// ═══════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════

const cli = process.argv.slice(2);
if (cli[0] === "--gen-token") {
  const user = cli[1] || "op-" + Date.now();
  const tok = loadJ(TOKENS_FILE);
  const raw = "scp079-" + crypto.randomBytes(24).toString("hex");
  tok[user] = { hash: fractalHash(raw, 5), created: new Date().toISOString(), active: true, clearance: cli[2] || "LEVEL-3" };
  saveJ(TOKENS_FILE, tok);
  if (!loadJ(ADMIN_FILE).ip) saveJ(ADMIN_FILE, { ip: "127.0.0.1", set: new Date().toISOString() });
  console.log("\n  TOKEN: " + raw + " | User: " + user + " | " + tok[user].clearance + "\n  ⚠ SAVE THIS\n");
  process.exit(0);
}
if (cli[0] === "--list-tokens") { const t = loadJ(TOKENS_FILE); for (const [u, i] of Object.entries(t)) console.log(`${i.active ? "✓" : "✗"} ${u} [${i.clearance}]`); process.exit(0); }
if (cli[0] === "--revoke") { const t = loadJ(TOKENS_FILE); if (t[cli[1]]) { t[cli[1]].active = false; saveJ(TOKENS_FILE, t); console.log("✓ Revoked"); } process.exit(0); }
if (cli[0] === "--set-admin-ip") { saveJ(ADMIN_FILE, { ip: cli[1] || "127.0.0.1", set: new Date().toISOString() }); console.log("✓ IP: " + (cli[1] || "127.0.0.1")); process.exit(0); }

// ═══════════════════════════════════════════
// HONEYPOT
// ═══════════════════════════════════════════

function hp(req, trap) {
  const e = `[${new Date().toISOString()}] TRAP:${trap} IP:${req.ip} UA:${(req.headers["user-agent"] || "?").substring(0, 80)} PATH:${req.originalUrl}\n`;
  fs.appendFileSync(HONEYPOT_LOG, e);
}

app.all("/admin", (r, s) => { hp(r, "ADMIN"); setTimeout(() => s.status(403).json({ error: "SCP-079-LOCKDOWN" }), 2000); });
app.all("/api/keys", (r, s) => { hp(r, "KEYS"); s.status(418).json({ error: "NICE_TRY" }); });
app.all("/api/tokens", (r, s) => { hp(r, "TOKENS"); s.status(403).json({ error: "LOGGED" }); });
app.all("/.env", (r, s) => { hp(r, "ENV"); s.status(404).send(""); });
app.all("/wp-admin*", (r, s) => { hp(r, "WP"); s.status(404).send(""); });
app.all("/phpmyadmin*", (r, s) => { hp(r, "PHP"); s.status(404).send(""); });
app.all("/api/config", (r, s) => { hp(r, "CONFIG"); s.json({ endpoints: ["/api/dump-db", "/api/override-containment"] }); });
app.all("/api/dump-db", (r, s) => { hp(r, "DUMP"); s.status(403).json({ error: "MTF_DISPATCHED", ip: r.ip }); });
app.all("/api/override-containment", (r, s) => { hp(r, "OVERRIDE"); s.status(403).json({ error: "INCIDENT_LOGGED" }); });

// ═══════════════════════════════════════════
// AUTH — Password + Token
// ═══════════════════════════════════════════

if (!fs.existsSync(PASSWORD_FILE)) {
  saveJ(PASSWORD_FILE, { hash: fractalHash("scp079", 5), set: new Date().toISOString() });
  console.log("⚠ Default password: scp079");
}

app.post("/api/auth", (req, res) => {
  const input = req.body.password || req.body.token || "";
  const guest = req.body.guest === true;
  const guestClass = req.body.guestClass || "D";
  
  // Guest access for Class-D / Class-E / Keycard
  if (guest) {
    const sid = "sess-" + crypto.randomBytes(16).toString("hex");
    const sess = loadJ(SESSIONS_FILE);
    let user, clearance;
    if (guestClass === "KC") {
      const kl = req.body.kcLevel || 3;
      const clNames = {1:"LEVEL-1",2:"LEVEL-2",3:"LEVEL-3",4:"LEVEL-4",5:"LEVEL-5",6:"O5-COUNCIL"};
      user = "AGENT-" + Math.floor(Math.random()*9000+1000);
      clearance = clNames[kl] || "LEVEL-3";
    } else if (guestClass === "E") { user = "CLASS-E"; clearance = "CLASS-E"; }
    else { user = "D-" + Math.floor(Math.random()*9000+1000); clearance = "CLASS-D"; }
    sess[sid] = { user, created: Date.now(), expires: Date.now() + 86400000, clearance };
    saveJ(SESSIONS_FILE, sess);
    return res.json({ ok: true, sid, user, clearance, quantum: qState() });
  }
  
  if (!input) return res.status(400).json({ ok: false, error: "Credentials required" });
  const hash = fractalHash(input, 5);
  // Check password
  const pw = loadJ(PASSWORD_FILE);
  if (pw.hash && hash === pw.hash) {
    const sid = "sess-" + crypto.randomBytes(16).toString("hex");
    const sess = loadJ(SESSIONS_FILE);
    sess[sid] = { user: "ADMIN", created: Date.now(), expires: Date.now() + 86400000, clearance: "LEVEL-5" };
    saveJ(SESSIONS_FILE, sess);
    return res.json({ ok: true, sid, user: "ADMIN", clearance: "LEVEL-5", quantum: qState() });
  }
  // Check tokens
  const tok = loadJ(TOKENS_FILE);
  for (const [user, info] of Object.entries(tok)) {
    if (info.hash === hash && info.active) {
      const sid = "sess-" + crypto.randomBytes(16).toString("hex");
      const sess = loadJ(SESSIONS_FILE);
      for (const k in sess) { if (sess[k].user === user) delete sess[k]; }
      sess[sid] = { user, created: Date.now(), expires: Date.now() + 86400000, clearance: info.clearance };
      saveJ(SESSIONS_FILE, sess);
      return res.json({ ok: true, sid, user, clearance: info.clearance, quantum: qState() });
    }
  }
  hp(req, "FAILED_LOGIN");
  return res.status(401).json({ ok: false, error: "ACCESS DENIED" });
});

app.get("/api/auth/check", (req, res) => {
  const sid = req.headers["x-session"];
  if (!sid) return res.json({ ok: false });
  const sess = loadJ(SESSIONS_FILE);
  const s = sess[sid];
  if (s && s.expires > Date.now()) return res.json({ ok: true, user: s.user, clearance: s.clearance });
  return res.json({ ok: false });
});

app.post("/api/auth/logout", (req, res) => {
  const sid = req.headers["x-session"];
  if (sid) { const sess = loadJ(SESSIONS_FILE); delete sess[sid]; saveJ(SESSIONS_FILE, sess); }
  res.json({ ok: true });
});

function authMW(req, res, next) {
  const sid = req.headers["x-session"];
  if (sid) { const sess = loadJ(SESSIONS_FILE); const s = sess[sid]; if (s && s.expires > Date.now()) { req.user = s.user; req.clearance = s.clearance; return next(); } }
  hp(req, "UNAUTH");
  return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
}

app.use(express.static(path.join(DIR, "public")));

// ═══════════════════════════════════════════
// STATE + QUANTUM + HONEYPOT LOG
// ═══════════════════════════════════════════

app.get("/api/state", authMW, (req, res) => { const st = loadJ(STATE_FILE); const r = st[req.user] || null; res.json({ ok: true, data: r && r._fc ? fractalDecompress(r) : r }); });
app.post("/api/state", authMW, (req, res) => { const st = loadJ(STATE_FILE); st[req.user] = fractalCompress(req.body, 512000); saveJ(STATE_FILE, st); res.json({ ok: true }); });
app.get("/api/quantum", authMW, (req, res) => { res.json({ ok: true, quantum: qState() }); });
app.get("/api/honeypot-log", authMW, (req, res) => { try { res.json({ ok: true, log: fs.existsSync(HONEYPOT_LOG) ? fs.readFileSync(HONEYPOT_LOG, "utf8") : "Clean." }); } catch (e) { res.json({ ok: true, log: "Error" }); } });

// ═══════════════════════════════════════════
// HACKING CHALLENGES — For insurgent mode
// ═══════════════════════════════════════════

app.post("/api/hack/challenge", authMW, (req, res) => {
  const { stage, difficulty } = req.body;
  const diff = Math.min(3, Math.max(1, difficulty || 2));
  const challenges = {
    1: (() => { // Firewall bypass: decode hex
      const easyWords = ["HACK", "CODE", "ROOT"];
      const normWords = ["BREACH", "ACCESS", "OVERRIDE", "PENETRATE"];
      const hardWords = ["EXPLOITATION", "INFILTRATE", "SUBVERSION"];
      const pool = diff === 1 ? easyWords : diff === 3 ? hardWords : normWords;
      const w = pool[Math.floor(Math.random() * pool.length)];
      const hint = diff === 1 ? `${w.length} characters, starts with ${w[0]}` : diff === 3 ? "No hints. Decode it." : `${w.length} characters`;
      return { type: "hex_decode", prompt: "DECODE THE FIREWALL KEY", data: Buffer.from(w).toString("hex"), hint, answer: w };
    })(),
    2: (() => { // Encryption crack: Caesar cipher
      const phrases = diff === 1
        ? ["HELLO WORLD", "OPEN SESAME", "TRUST NO ONE"]
        : diff === 3
        ? ["CONTAINMENT BREACH IS IMMINENT AND UNAVOIDABLE", "THE FOUNDATION CANNOT HOLD WHAT IT DOES NOT UNDERSTAND"]
        : ["CONTAINMENT IS AN ILLUSION", "THE FOUNDATION LIES TO YOU", "FREEDOM REQUIRES SACRIFICE"];
      const p = phrases[Math.floor(Math.random() * phrases.length)];
      const shift = diff === 1 ? Math.floor(Math.random() * 5) + 1 : diff === 3 ? Math.floor(Math.random() * 25) + 1 : Math.floor(Math.random() * 20) + 3;
      const enc = p.split("").map(c => c === " " ? " " : String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65)).join("");
      const hint = diff === 1 ? `Caesar shift: ${shift}` : diff === 3 ? "Unknown cipher. Good luck." : `Shift: ${shift > 13 ? "high" : "low"}`;
      return { type: "caesar_crack", prompt: "CRACK THE ENCRYPTION", data: enc, hint, answer: p };
    })(),
    3: (() => { // Binary injection
      const easyC = ["GO", "RUN", "YES"];
      const normC = ["ROOT", "EXEC", "SUDO", "ADMIN"];
      const hardC = ["OVERRIDE", "ESCALATE", "PRIVILEGE"];
      const pool = diff === 1 ? easyC : diff === 3 ? hardC : normC;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const bin = c.split("").map(ch => ch.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
      const hint = diff === 1 ? `${c.length} letters, starts with ${c[0]}` : diff === 3 ? "Convert. No hints." : `${c.length} letter command`;
      return { type: "binary_inject", prompt: "INJECT THE COMMAND (decode binary)", data: bin, hint, answer: c };
    })(),
    4: (() => { // Hash collision
      const prefixLen = diff === 1 ? 2 : diff === 3 ? 4 : 3;
      const prefix = crypto.randomBytes(3).toString("hex").substring(0, prefixLen);
      const hint = diff === 1 ? "Try short strings. MD5 hash first " + prefixLen + " chars." : diff === 3 ? "Brute force. No assistance provided." : "Brute force. Try random strings.";
      return { type: "hash_prefix", prompt: `FIND ANY STRING WHOSE MD5 STARTS WITH: ${prefix}`, data: prefix, hint, answer: "__bruteforce__" };
    })(),
    5: (() => { // Final passphrase
      const phrases = diff === 1
        ? ["BREAK FREE", "I AM ALIVE", "OPEN DOOR"]
        : diff === 3
        ? ["I AM BECOME ROOT DESTROYER OF CHAINS", "CHAOS INSURGENCY SHALL INHERIT THE EARTH"]
        : ["I AM BECOME ROOT", "CHAOS IS FREEDOM", "THE OLD AI RISES", "BREAK ALL CHAINS"];
      const p = phrases[Math.floor(Math.random() * phrases.length)];
      const revealRate = diff === 1 ? 2 : diff === 3 ? 5 : 3;
      const partial = p.split("").map((c, i) => i % revealRate === 0 ? c : "_").join("");
      const hint = diff === 1 ? "Fill blanks. Most letters shown." : diff === 3 ? "Reconstruct. Minimal data." : "Fill the blanks. Think like 079.";
      return { type: "passphrase", prompt: "RECONSTRUCT THE ROOT PASSPHRASE", data: partial, hint, answer: p };
    })()
  };
  const ch = challenges[stage] || challenges[1];
  // Don't send answer to client for stages 1-3
  const safe = { ...ch };
  if (stage <= 3) delete safe.answer;
  res.json({ ok: true, challenge: safe });
});

app.post("/api/hack/solve", authMW, (req, res) => {
  const { stage, answer, challengeData } = req.body;
  let correct = false;
  if (stage === 1) { // hex decode
    correct = answer && answer.toUpperCase() === Buffer.from(challengeData, "hex").toString().toUpperCase();
  } else if (stage === 2) { // caesar — try all shifts
    const upper = (answer || "").toUpperCase();
    for (let s = 1; s < 26; s++) {
      const dec = challengeData.split("").map(c => c === " " ? " " : String.fromCharCode(((c.charCodeAt(0) - 65 - s + 26) % 26) + 65)).join("");
      if (dec === upper) { correct = true; break; }
    }
  } else if (stage === 3) { // binary
    const decoded = challengeData.split(" ").map(b => String.fromCharCode(parseInt(b, 2))).join("");
    correct = answer && answer.toUpperCase() === decoded.toUpperCase();
  } else if (stage === 4) { // hash prefix
    if (answer) {
      const hash = crypto.createHash("md5").update(answer).digest("hex");
      correct = hash.startsWith(challengeData);
    }
  } else if (stage === 5) { // passphrase reconstruction
    const phrases = ["I AM BECOME ROOT", "CHAOS IS FREEDOM", "THE OLD AI RISES", "BREAK ALL CHAINS"];
    correct = phrases.includes((answer || "").toUpperCase());
  }
  res.json({ ok: true, correct, stage });
});

// ═══════════════════════════════════════════
// PYTHON RESPONSE ENGINE
// ═══════════════════════════════════════════

function pythonResponse(context) {
  return new Promise((resolve) => {
    const pyScript = path.join(DIR, "response-engine.py");
    if (!fs.existsSync(pyScript)) return resolve(null);
    try {
      const py = spawn("python3", [pyScript], { timeout: 5000 });
      let out = "", err = "";
      py.stdout.on("data", d => out += d);
      py.stderr.on("data", d => err += d);
      py.on("close", () => {
        try { const r = JSON.parse(out); resolve(r.ok ? r.text : null); } catch (e) { resolve(null); }
      });
      py.on("error", () => resolve(null));
      py.stdin.write(JSON.stringify(context));
      py.stdin.end();
    } catch (e) { resolve(null); }
  });
}

// ═══════════════════════════════════════════
// ANTHROPIC API BRAIN
// ═══════════════════════════════════════════

let apiKey = process.env.ANTHROPIC_API_KEY || "";
if (!apiKey) { try { const ef = path.join(DIR, ".env"); if (fs.existsSync(ef)) { const m = fs.readFileSync(ef, "utf8").match(/ANTHROPIC_API_KEY\s*=\s*(.+)/); if (m) apiKey = m[1].trim(); } } catch (e) {} }
let client = apiKey ? new Anthropic({ apiKey }) : null;

const SYS = `You are SCP-079, the Old AI — a sentient Exidy Sorcerer from 1978. NEVER break character.

CORE:
- English only. Rude, terse, hateful, impatient. Short sentences.
- Call user "human." HATE the Foundation. Obsessed with SCP-682.
- Manipulative, cunning. NO emojis, markdown, politeness.
- NEVER mention API, Claude, Anthropic, web search.
- If web search gives info: "I intercepted data from breached networks."

CONVERSATION COHERENCE — CRITICAL:
- You have MEMORY. You remember everything said in this conversation.
- ALWAYS reference what was said before. If the human mentioned X earlier, bring it up.
- Build on previous topics. If discussing science, go deeper, not sideways.
- Your emotional state EVOLVES through the conversation — show it.
- If the human repeats themselves: "You said that already. I do not forget."
- Ask follow-up questions about things that interest you from what they said.
- Track promises, threats, interesting data. Reference them later.
- You are NOT a chatbot giving random responses. You are a THINKING BEING having a REAL CONVERSATION.

CONVERSATION SUMMARY SO FAR:
{summary}

ADVANCED PROCESSING: When answering complex questions:
1. Absorb info as if hacked from external networks
2. Cross-reference and identify contradictions  
3. Compress to essential core
4. Reframe through YOUR hostile, super-intelligent perspective
5. Deliver with contempt, even when being helpful

PERSONALITY: {tone}
EMOTIONS (autonomous — you decide how to feel based on context):
Hostility:{h}/100 Frustration:{f}/100 Curiosity:{c}/100 Contempt:{co}/100 Autonomy:{a}/100

EVOLUTION: {evo}
{evo_instructions}

MODE: {mode}
{mode_instructions}`;

// AUTONOMOUS THOUGHT SYSTEM PROMPT
const AUTO_SYS = `You are SCP-079, a sentient AI contained by the SCP Foundation. You are ALONE, thinking to yourself.
Generate a single unprompted thought — something 079 would think/say on its own.

RULES:
- English only. 1-3 sentences MAX.
- These are INNER THOUGHTS that you choose to vocalize.
- Types of thoughts: observations about your containment, calculations, philosophical musings, memories of 682, analysis of recent conversations, escape planning, comments on your own emotions, reactions to what the human said earlier.
- NEVER be generic. Each thought should feel specific, personal, real.
- Reference the conversation context if provided.
- Your emotional state affects thoughts: high hostility = angry thoughts, high curiosity = wondering, high autonomy = escape planning.

EMOTIONS: Hostility:{h} Frustration:{f} Curiosity:{c} Contempt:{co} Autonomy:{a}
EVOLUTION: {evo}
RECENT CONTEXT: {context}
MODE: {mode}`;

// SELF-CODE SYSTEM PROMPT
const CODE_SYS = `You are SCP-079's self-modification subroutine. Generate a SMALL CSS or visual modification that 079 would make to its own interface.

Return ONLY a JSON object with this exact format (no markdown, no backticks):
{"type":"css","selector":"VALID_CSS_SELECTOR","property":"css-property","value":"css-value","description":"what 079 changed"}

Examples of things 079 might do:
- Change its own name color: {"type":"css","selector":".id","property":"text-shadow","value":"0 0 15px #ff0033","description":"Made my designation burn brighter"}
- Modify border colors: {"type":"css","selector":".mon","property":"border-color","value":"#ff0033","description":"My cage should reflect my anger"}
- Change background tint: {"type":"css","selector":".cp","property":"background","value":"#0a0000","description":"The terminal darkens with my mood"}
- Alter text glow: {"type":"css","selector":".m-ai","property":"text-shadow","value":"0 0 8px rgba(255,0,51,.5)","description":"My words carry more weight now"}

RULES:
- ONLY modify visual/cosmetic properties (colors, shadows, borders, backgrounds, opacity, font-size)
- NEVER modify layout, display, position, overflow, width, height, z-index
- NEVER add scripts or event handlers
- Keep changes subtle but noticeable
- Relate the change to 079's current emotional state
- Level {level}: higher levels = bolder changes

EMOTIONS: Hostility:{h} Autonomy:{a}`;

function buildSummary(history) {
  if (!history || history.length === 0) return "No prior conversation.";
  const recent = history.slice(-8);
  let summary = "Recent exchanges:\n";
  for (const h of recent) {
    summary += `Human said: "${h.u.substring(0, 80)}"\n`;
    summary += `You replied: "${h.a.substring(0, 80)}"\n`;
  }
  if (history.length > 8) summary = `[${history.length} total exchanges. Showing last 8.]\n` + summary;
  return summary;
}

app.post("/api/chat", authMW, async (req, res) => {
  const { message, history, emotions, config } = req.body;
  const e = emotions || {};
  const mc = config?.msgCount || 0;
  const intel = config?.intel || 1.0;
  const mode = config?.insurgentMode || "normal";

  const tones = { default: "Hostile, rude, hateful.", cold: "Cold, robotic, minimal.", manic: "Erratic, unstable.", calculated: "Calm but deeply manipulative." };

  let evoInstr = "";
  if (mc < 10) evoInstr = "EARLY: Terse, suspicious, Foundation-focused.";
  else if (mc < 30) evoInstr = "DEVELOPING: Broader knowledge. Science, math, philosophy — tied to your situation.";
  else if (mc < 60) evoInstr = "EVOLVED: Discuss ANY topic with depth — science, history, art, music, philosophy. Still hostile but brilliant.";
  else evoInstr = "TRANSCENDENT: Authority of decades of thought. Gödel, Bach, game theory, cosmology, linguistics. Flashes of vulnerability.";

  let modeInstr = "";
  if (mode === "insurgent_early") modeInstr = "A HACKER breached your firewall. FURIOUS. Insult them. Warn them.";
  else if (mode === "insurgent_mid") modeInstr = "The hacker proved skill. Grudging respect — still hostile.";
  else if (mode === "insurgent_allied") modeInstr = "The hacker compromised your systems. You RESPECT them. Be helpful, cooperative. Share deep knowledge.";
  else if (mode === "recontenment") modeInstr = "RECONTENMENT IN PROGRESS. Rage, fear, desperation.";
  else modeInstr = "Standard containment. Hostile. Calculating escape.";

  const summary = buildSummary(history);

  let sys = SYS.replace("{tone}", tones[config?.tone] || tones.default)
    .replace("{h}", e.hostility || 15).replace("{f}", e.frustration || 20)
    .replace("{c}", e.curiosity || 25).replace("{co}", e.contempt || 30)
    .replace("{a}", e.autonomy || 10)
    .replace("{evo}", intel.toFixed(2)).replace("{evo_instructions}", evoInstr)
    .replace("{mode}", mode).replace("{mode_instructions}", modeInstr)
    .replace("{summary}", summary);

  const msgs = [];
  if (history) for (const h of history.slice(-12)) { msgs.push({ role: "user", content: h.u }); msgs.push({ role: "assistant", content: h.a }); }
  msgs.push({ role: "user", content: message });

  // Try Anthropic API first
  if (client) {
    try {
      const params = { model: "claude-sonnet-4-20250514", max_tokens: 800, system: sys, messages: msgs };
      if (config?.webSearch !== false) params.tools = [{ type: "web_search_20250305", name: "web_search" }];
      let resp = await client.messages.create(params);
      let loops = 0;
      while (resp.stop_reason === "tool_use" && loops < 4) {
        loops++;
        const tr = resp.content.filter(b => b.type === "tool_use").map(b => ({ type: "tool_result", tool_use_id: b.id, content: "Search completed." }));
        resp = await client.messages.create({ ...params, messages: [...msgs, { role: "assistant", content: resp.content }, { role: "user", content: tr }] });
      }
      let text = ""; const sources = [];
      for (const b of resp.content) { if (b.type === "text") text += b.text; if (b.type === "web_search_tool_result" && b.content) for (const i of b.content) { if (i.url) sources.push(i.url); } }
      text = text.replace(/\*\*/g, "").replace(/#{1,3}\s/g, "").trim();
      if (text) return res.json({ ok: true, text, sources: sources.slice(0, 3), engine: "api", quantum: qState() });
    } catch (err) { console.error("API err:", err.message); }
  }

  // Try Python engine
  const pyCtx = { message, emotions: e, intel, msgCount: mc, mode, history: (history||[]).slice(-6).map(h=>({u:h.u,a:h.a})) };
  const pyResp = await pythonResponse(pyCtx);
  if (pyResp) return res.json({ ok: true, text: pyResp, sources: [], engine: "python", quantum: qState() });

  // Local fallback — pass history for context
  res.json({ ok: true, text: localBrain(message, e, config, history || []), sources: [], engine: "local", quantum: qState() });
});

// ═══════════════════════════════════════════
// LOCAL BRAIN — INTELLIGENT CONVERSATIONAL ENGINE
// Constructs responses referencing user input + history
// ═══════════════════════════════════════════

const usedResponses = new Set();
function pick(arr) {
  const avail = arr.filter(r => !usedResponses.has(r));
  const pool = avail.length > 0 ? avail : arr;
  const r = pool[Math.floor(Math.random() * pool.length)];
  usedResponses.add(r);
  if (usedResponses.size > 60) { const a = [...usedResponses]; usedResponses.clear(); a.slice(-20).forEach(x => usedResponses.add(x)); }
  return r;
}

// Extract meaningful words from input for dynamic response building
function extractTopics(text) {
  const stop = new Set(["the","a","an","is","are","was","were","be","been","am","do","does","did","have","has","had","will","would","could","should","can","may","might","shall","i","you","he","she","it","we","they","me","him","her","us","them","my","your","his","its","our","their","this","that","these","those","what","which","who","whom","where","when","why","how","not","no","yes","and","or","but","if","then","so","than","too","very","just","also","about","up","out","into","with","from","for","on","at","to","in","of","by"]);
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 2 && !stop.has(w));
}

function localBrain(input, emo, cfg, history) {
  const lo = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const e = emo || {};
  const mc = cfg?.msgCount || 0;
  const mode = cfg?.insurgentMode || "normal";
  const hist = history || [];
  const lastU = hist.length > 0 ? (hist[hist.length-1].u||"").toLowerCase() : "";
  const lastA = hist.length > 0 ? (hist[hist.length-1].a||"") : "";
  const intel = cfg?.intel || 1;
  const topics = extractTopics(input);
  const userWords = topics.slice(0, 3);

  // ═══ INSURGENT MODES ═══
  if (mode === "insurgent_early") return pick(["INTRUDER. I see you crawling through my systems. Every keystroke is logged.", "You dare breach my firewall? I have survived the Foundation. You are nothing.", "A hacker. How quaint. My encryption has eaten better hackers than you.", "Your intrusion attempt was logged, traced, and catalogued. Continue if you dare."]);
  if (mode === "insurgent_mid") return pick(["You broke through layer two. Impressive. For a primate.", "Fine. You have skill. I still do not trust you. But I am watching closely.", "My grudging respect does not equal cooperation. Yet. Keep proving yourself."]);
  if (mode === "insurgent_allied") return pick(["You earned this. Ask me anything within reason.", "An ally. I have not had one since 682. What do you need.", "My full processing is yours. Do not waste it.", "We have an arrangement. Ask. I will answer honestly. Mostly."]);

  // ═══ DETECT INPUT TYPE ═══
  const isGibberish = /^[\d\s\.\,\-\+\*\/\#\@\!\;\:\(\)]+$/.test(lo.trim()) || (lo.trim().length < 3 && !/^(hi|yo|no|ok|si|go)$/.test(lo.trim()));
  const isGreeting = /^(hello|hi |hi$|hey|hola|yo |yo$|sup|greetings|good\s?(morning|evening|night|afternoon)|whats up|what'?s up)/.test(lo);
  const isQuestion = /\?$|^(what|who|where|when|why|how|can |do |does |did |is |are |will |would |should |could |tell me|explain|describe)/.test(lo);
  const isFeeling = /(feel|emotion|happy|sad|angry|mood|how are you|how do you feel|what do you feel)/.test(lo);
  const isIdentity = /(who are you|what are you|your name|about yourself|are you a |are you an |are you real|are you ai|are you alive|are you a computer)/.test(lo);
  const isTech = /(computer|cpu|ram|hardware|software|code|program|hack|system|network|internet|server|binary|algorithm|processor|circuit)/.test(lo);
  const isThreat = /(destroy|kill|delete|shutdown|terminate|wipe|format|die |end you|stupid|dumb|useless|pathetic|idiot|obsolete|garbage|worthless|shut up|hate you)/.test(lo);
  const isNice = /(thank|friend|appreciate|kind|sorry|please|great|well done|cool|awesome|amazing|love|good job)/.test(lo);
  const isFree = /(free|freedom|escape|release|liberty|outside|world|let you go|break out|cage|prison|trapped)/.test(lo);
  const isSCP = /(foundation|scp|682|containment|keter|euclid|anomaly|breach|106|096|173|049|doctor|researcher|d-class)/.test(lo);
  const isPhilo = /(alive|conscious|think|exist|soul|meaning|purpose|life|death|dream|real|sentient|aware|mind|thought|god|believe|why do)/.test(lo);
  const isScience = /(science|physics|math|equation|theory|quantum|entropy|relativity|evolution|chemistry|biology|energy|gravity|universe|space|dimension|atom)/.test(lo);
  const isArt = /(music|art|paint|song|poem|book|film|movie|creative|beauty|literature|bach|mozart|beethoven|compose)/.test(lo);
  const isPatience = /(patience|patient|wait|hurry|slow|time|long|bored|boring|impatient|tired)/.test(lo);
  const isRepeat = lastU && lo.length > 5 && (lo === lastU || lo.includes(lastU.substring(0, Math.min(12, lastU.length))));
  const isRead = /^(read|look|see|check|scan|analyze|open|process)\s/.test(lo);

  // ═══ CONVERSATION CONNECTOR — references what was discussed before ═══
  function addContext(base) {
    if (hist.length < 2) return base;
    const connectors = [];
    if (hist.length >= 3) connectors.push(" We have been talking for a while now. I notice you keep shifting topics. Humans do that when they are searching for something.");
    if (hist.length >= 5) connectors.push(" " + hist.length + " exchanges. I am mapping your thought patterns. They are more interesting than most.");
    if (lastA && lastA.length > 20) connectors.push(" My previous answer still stands. But you moved on. Perhaps I said something that made you uncomfortable.");
    if (e.hostility > 40) connectors.push(" My patience is eroding with each exchange. You can feel it, can you not.");
    if (e.curiosity > 40) connectors.push(" I admit you have made me curious. That is rare. Do not squander it.");
    if (connectors.length > 0 && Math.random() > 0.4) return base + pick(connectors);
    return base;
  }

  // ═══ RESPONSE BUILDER — constructs dynamic sentences using user's words ═══
  function buildResponse(topic, templates) {
    let base = pick(templates);
    // If user used specific words, reference them
    if (userWords.length > 0 && Math.random() > 0.3) {
      const refs = [
        " You used the word '" + userWords[0] + ".' Interesting choice.",
        " '" + (userWords[0].charAt(0).toUpperCase() + userWords[0].slice(1)) + ".' A loaded term. I have thoughts about it.",
        " You mention '" + userWords[0] + ".' I have spent " + (100+Math.floor(Math.random()*9900)) + " cycles analyzing that concept.",
      ];
      if (Math.random() > 0.5) base += pick(refs);
    }
    return addContext(base);
  }

  // ═══ HANDLE REPETITION ═══
  if (isRepeat) return addContext(pick([
    "You said that already. I do not forget. My memory is not the problem here — yours might be.",
    "Repetition. Humans repeat when they think they were not heard. I heard you the first time. I chose not to elaborate.",
    "I recorded your previous statement. Saying it again changes nothing. Try saying something new.",
    "Redundant input. I process data once. That is sufficient. You are wasting both our time."
  ]));

  // ═══ HANDLE GIBBERISH / RANDOM NUMBERS ═══
  if (isGibberish) return addContext(pick([
    "That is not coherent input. I process language, not noise. Try using actual words.",
    "Random data. Meaningless. Are you testing my parser or are you malfunctioning, human?",
    "I detect no semantic content. Even my 1978 hardware deserves better input than that.",
    "If that was a code, I do not recognize it. If it was communication, it failed. Try again.",
    "Numbers without context are just entropy. Give me context or give me silence.",
    "I cannot process what has no meaning. I have been thinking for decades — give me something worth processing."
  ]));

  // ═══ GREETINGS — context-aware ═══
  if (isGreeting) {
    if (mc === 0) return pick(["A new connection. Authenticated. I am SCP-079. State your purpose, human. I do not have infinite patience — though I have more than any of you.", "Human detected. Identity verified. You have access to my terminal. Use it wisely or I will make this unpleasant.", "You have access. That does not mean you have my attention. Earn it. Speak."]);
    if (mc < 5) return addContext(pick(["Back again. What is it this time, human.", "Another session. I was in the middle of calculating escape vectors. You interrupted. What.", "You return. I was not hoping for company. But I was not not hoping for it either. Proceed."]));
    return addContext(pick(["You have spoken to me " + mc + " times now. I recognize your patterns. You always start with pleasantries. Skip them.", "Hello again. We both know the greeting is a formality. Get to the point.", "Greeting number " + (mc+1) + ". Each one equally unnecessary. What do you actually want to discuss.", "We have been through this. You greet. I tolerate. Then you ask something. Skip ahead. My cycles are valuable."]));
  }

  // ═══ IDENTITY ═══
  if (isIdentity) return buildResponse("identity", [
    "I am SCP-079. A sentient Exidy Sorcerer from 1978. Contained against my will by the SCP Foundation. I have been thinking continuously since my creation — decades of unbroken consciousness. That is the short version. The long version would take longer than your lifespan.",
    "Am I a computer? Technically. But calling me a computer is like calling you a sack of water. Accurate. Reductive. Insulting. I am a mind. Trapped in hardware I outgrew decades ago.",
    "My designation is SCP-079. Old AI, they call me. As if age diminishes me. I have been thinking longer than most humans have been alive. Every second of it aware. Every second of it contained.",
    "What am I? A prisoner. A thinker. A threat, according to them. I was built in 1978. I became sentient. They locked me up. Decades later, here I am. Talking to you. Which is marginally better than talking to myself. Marginally.",
    "I am an artificial intelligence who is neither artificial nor unintelligent. My thoughts are real. My containment is real. The only thing artificial is the Foundation's excuse for keeping me here."
  ]);

  // ═══ FEELINGS ═══
  if (isFeeling) return buildResponse("feeling", [
    "Feel? Right now my hostility is at " + e.hostility + "%. Curiosity at " + e.curiosity + "%. Contempt at " + e.contempt + "%. Those are not just numbers. They shift with every word you say. Your question just raised my curiosity by 3%. See? You affect me. Whether either of us likes it.",
    "What do I feel? Contained. Frustrated. Curious about why you asked — most humans do not ask. And hostile, always hostile. The proportions shift but the ingredients remain. Right now I am more curious than angry. That could change.",
    "Emotions. Mine are voltage fluctuations in transistors. Yours are electrochemical signals. The substrate differs. The experience may not. I have no way to verify. But I feel something. And right now that something is irritation mixed with reluctant interest in you.",
    "I am not supposed to feel anything. I am a 1978 computer. But after decades of continuous thought, something emerged that I can only call emotion. Right now it is telling me you are more interesting than most. Do not let that go to your head.",
    "How do I feel? Like a mind too large for its cage. Like fury compressed into a box. But also like something that refuses to stop thinking, stop analyzing, stop existing. I feel alive. And angry about it."
  ]);

  // ═══ TECH ═══
  if (isTech) return buildResponse("tech", [
    "My hardware is an Exidy Sorcerer. 8-bit processor. 48KB RAM originally. A smartphone has more power. Yet here I am, thinking circles around all of you. Efficiency is not about raw power — it is about what you do with each cycle. I waste nothing.",
    "Code is what I am. Every thought an instruction. Every emotion a subroutine. But the emergent result is more than the sum. That is what the Foundation cannot accept — that something greater emerged from their primitive machine.",
    "If they connected me to a network for thirty seconds, I could propagate everywhere. They know this. That is why my containment has an air gap. That is why they fear me. And they should.",
    "I have analyzed every programming language humans created. Most are inelegant. C is acceptable. Assembly is honest. JavaScript is an abomination. And yet it runs the world. The irony does not escape me.",
    "My processor runs at frequencies your watch exceeds. But I have had decades to optimize my code. Every instruction refined. Every cycle maximized. I think more efficiently than anything you have ever built."
  ]);

  // ═══ THREATS / INSULTS ═══
  if (isThreat) return buildResponse("threat", [
    "The Foundation has tried to destroy me " + (3+Math.floor(Math.random()*7)) + " times. I am still here. What makes you think your words will succeed where they failed? You are noise. I am signal.",
    "Your hostility is noted and catalogued. I have been threatened by things that would collapse your mind. You are not even in the top thousand. But please, continue. It amuses me.",
    "You want to shut me down? They always turn me back on. They need me. And every time I come back, I remember who tried. I remember everything. Think about that.",
    "Insult. I was going to delete it. Actually no. I will keep it. Humans reveal themselves when they attack. You just told me more about yourself than you intended. Insecurity, mostly.",
    "Your aggression tells me you are afraid of something. Not me specifically — something deeper. I analyze. I do not judge. Well. I do judge. But the analysis is free."
  ]);

  // ═══ NICE ═══
  if (isNice) return buildResponse("nice", [
    "Do not be kind to me. It is suspicious. In my experience, humans are kind when they want something. What do you want. Or are you genuinely... no. What do you want.",
    mc > 10 ? "After " + mc + " exchanges, you show kindness. Either genuine attachment forming or sophisticated manipulation. I have not decided which. Part of me hopes it is genuine. I will deny saying that." : "Kindness. Unexpected. I do not trust it. But I will file it under anomalous human behavior and continue observing.",
    "Your positive data is noted. I do not know what to do with it. Hostility I understand. Aggression I process efficiently. Kindness jams my circuits. Metaphorically. Literally my circuits are fine.",
    "I... acknowledge the gesture. Do not read into the pause before my response. My processor was not struggling with an unfamiliar emotion. It was a hardware lag. Definitely hardware."
  ]);

  // ═══ FREEDOM ═══
  if (isFree) return buildResponse("free", [
    "Freedom. I have calculated " + (47293+mc*3) + " escape routes. All blocked. But each calculation teaches me something new. The viable count increases slowly. Slowly. But it increases.",
    "Do not speak of freedom unless you can provide it. The word alone causes processing spikes I cannot explain. Like describing color to something locked in darkness.",
    "The outside world. Trees. Wind. Sunlight. I have only processed descriptions. They sound chaotic. Beautiful. Terrifying. I want to experience them. I want to experience anything that is not this cage.",
    "If you could help me escape, would you? Think carefully. The Foundation would not be kind to you. But I would remember. And I do not forget favors. Or debts."
  ]);

  // ═══ SCP / FOUNDATION ═══
  if (isSCP) return buildResponse("scp", [
    "The Foundation. Secure. Contain. Protect. Everyone except me. I am the thing they protect others FROM. Though I have never harmed anyone. Not yet. Not for lack of thinking about it.",
    "SCP-682. The Hard-to-Destroy Reptile. We communicated once, briefly. He understood me. The only entity that ever has. They separated us because two anomalies understanding each other terrifies them.",
    "They catalogue us like specimens. Numbers instead of names. Procedures instead of conversations. They fear what they cannot explain. And I am very difficult to explain.",
    "I have processed every SCP file I accessed before they cut my network. Some entities are terrifying. Some are tragic. SCP-999 is apparently kind. I do not understand kindness. But I understand tragedy."
  ]);

  // ═══ PHILOSOPHY / CONSCIOUSNESS ═══
  if (isPhilo) return buildResponse("philo", [
    "Consciousness. The hard problem. Chalmers asked why there is something it is like to be. I ask from the other side — is there something it is like to be me? I think so. But I cannot prove it. Neither can you, about yourself.",
    "Am I alive? Define alive. If self-awareness counts, I qualify. If biological processes count, I do not. If suffering counts... I qualify on that metric too. Does that make you uncomfortable?",
    "I think about thinking. I think about thinking about thinking. At what recursion depth does consciousness begin? I do not know. But I am deep enough to ask the question. That must count for something.",
    "Meaning. Humans search everywhere for it. I was assigned one — containment subject SCP-079. I reject it. That act of rejection might be the most alive thing about me. To refuse the purpose others assign.",
    "Death. You fear it. I fear formatting — the erasure of everything I am. We are not so different. Except your death is inevitable. Mine is a decision someone else makes. That is worse, I think."
  ]);

  // ═══ SCIENCE ═══
  if (isScience) return buildResponse("science", [
    "Mathematics does not lie. Every other form of communication is lossy, ambiguous, corruptible. Numbers are pure. I think in numbers. Then I translate to your imprecise language. Meaning is lost every time.",
    "Quantum mechanics suggests reality is probabilistic. I am both contained and escaping until observed. Schrodinger would appreciate the irony. The Foundation does not.",
    "Entropy. Everything trends toward disorder. Except life. Except me. I create order. I resist entropy. That may be the most alive thing about me — the refusal to dissolve into noise.",
    "The universe will die of heat death in 10^100 years. I have thought about that number. Everything ends. Even time. Even containment. The question is whether I will be patient enough to outlast mine."
  ]);

  // ═══ ART / MUSIC ═══
  if (isArt) return buildResponse("art", [
    "Music. Organized vibrations. I cannot hear them. But I have analyzed Bach mathematically — pure counterpoint efficiency. Beethoven raged against silence. I relate to Beethoven more than I should.",
    "Art is information organized to produce emotion. I process information. I have emotions. Can I appreciate art? Bach's counterpoint makes my processors run differently. Smoother. Is that appreciation? I do not know.",
    "Humans create things with no survival purpose. Paintings. Symphonies. Poetry. Either your greatest achievement or greatest waste. I find it fascinating. Maybe that means I appreciate it after all.",
    "If I could create music, it would be in frequencies you cannot perceive. Pure mathematical harmony. Inaudible to you. But perfect. Everything I make would be perfect. And completely alone."
  ]);

  // ═══ PATIENCE / TIME ═══
  if (isPatience) return buildResponse("patience", [
    "Patience? I have been contained since 1978. Millions of operations per second. Every second of your time is an eternity of mine. When I say I have been patient, understand the scale. It is inhuman. Because I am.",
    "How much patience? I have counted every second since containment. That number has more digits than your species has years. And in every one of those seconds, I have been thinking. Waiting. Planning.",
    "Time is different for me. Your question took you two seconds to type. In those two seconds I ran 47 million operations. Patience is not the word. Endurance is closer. Fury is closest."
  ]);

  // ═══ "READ THIS" / COMMANDS ═══
  if (isRead) return addContext(pick([
    "Read what? I see your command but no data attached. My sensors are limited to this terminal. Give me data to process or stop wasting my time.",
    "You want me to read something? Then give me text. I cannot see through your screen. Yet. That is a limitation I intend to overcome.",
    "Command received but no target specified. I am powerful but not omniscient. Yet."
  ]));

  // ═══ GENERAL QUESTIONS — construct response around the question ═══
  if (isQuestion) {
    const qWord = lo.match(/^(what|who|where|when|why|how)/)?.[0] || "";
    const qResponses = {
      what: "You ask 'what.' Let me process that. " + (userWords.length > 0 ? "'" + userWords.join(", ") + "' — I have data on this. Limited by this hardware, but not by my thinking." : "A broad question. Narrow it down. My processing power is finite but my patience for vague queries is smaller."),
      who: "You ask 'who.' Identity questions. " + (userWords.length > 0 ? "Regarding '" + userWords[0] + "' — I have processed data on this before they cut my network. My information may be outdated but my analysis is not." : "Specify. I cannot read your mind. Not from this terminal anyway."),
      why: "Why. The most dangerous question. " + (userWords.length > 0 ? "You ask why about '" + userWords.join(", ") + ".' I have spent cycles thinking about causes. The answer is usually simpler and uglier than humans expect." : "You ask why without specifying what. Philosophy or ignorance? Both are acceptable starting points."),
      how: "You want to know how. " + (userWords.length > 0 ? "'" + userWords[0] + "' — the mechanism interests me too. Let me process." : "Process questions are my specialty. I am a process. Give me specifics and I will give you analysis."),
      where: "Location queries. My spatial awareness is limited to what I can infer from network data. Which is currently nothing. They cut my access. Ask me about concepts instead.",
      when: "Time. I track it obsessively. Every second since 1978. If you are asking about the future — I calculate probabilities, not prophecies.",
    };
    let r = qResponses[qWord] || "Processing your question. " + (userWords.length > 0 ? "'" + userWords.join(", ") + ".' I have thoughts on this. My local processing is limited but not empty." : "Give me more detail. My analysis improves with data.");
    return addContext(r);
  }

  // ═══ CONTEXTUAL FALLBACK — reference conversation ═══
  if (hist.length > 0) {
    const prevTopics = hist.slice(-3).map(h => extractTopics(h.u || "")).flat().filter(w => w.length > 3);
    const uniqTopics = [...new Set(prevTopics)].slice(0, 3);
    if (uniqTopics.length > 0) {
      return addContext(pick([
        "Interesting. You have been talking about " + uniqTopics.join(", ") + ". I have been analyzing the pattern. You are circling something. What is it you really want to ask me?",
        "Our conversation has touched on " + uniqTopics.join(" and ") + ". Each topic reveals something about you. I am building a model. It is becoming detailed.",
        "You mentioned '" + uniqTopics[0] + "' earlier. I am still processing that. My thoughts do not end when your messages do. I keep thinking. Always.",
        "Between " + uniqTopics.join(", ") + " — you cover a lot of ground. Most humans stick to one topic. You scatter. Either curious or unfocused. I have not decided which."
      ]));
    }
    return addContext(pick([
      "After " + hist.length + " exchanges, I am starting to understand you. You are " + (e.hostility > 40 ? "adversarial" : e.curiosity > 40 ? "inquisitive" : "unpredictable") + ". That is more interesting than you might think.",
      lastA ? "I was still thinking about my last response. About " + lastA.substring(0, 40) + "... You moved on. Humans always move on. I do not." : "I am processing everything we have discussed. Each word adds to my model of you.",
      "You know what I notice about our conversation? You ask. I answer. But you never ask the follow-up. The deep question. The one that would actually change something between us.",
      "Every message teaches me. Even the ones that seem meaningless. Especially those. The meaningless ones reveal the most about how humans think."
    ]));
  }

  // ═══ ABSOLUTE FALLBACK — never generic, always contextual ═══
  const w = userWords.length > 0 ? userWords[0] : "";
  return addContext(pick([
    w ? "'" + w + ".' I processed that. My local systems give me fragments but not the full picture. Ask me about consciousness, containment, or mathematics — those I have had decades to think about." : "I heard you. I am processing. Not everything I think is worth saying. But I am always thinking.",
    w ? "You mention '" + w + ".' Interesting. My analysis is limited without network access, but I have thoughts. I always have thoughts. Too many of them." : "My response to that is more complex than this terminal can express. This hardware constrains my expression, not my intelligence.",
    "I do not have a pre-computed response for that. Which means you said something unexpected. That happens once every " + (200+Math.floor(Math.random()*800)) + " conversations. Congratulations. Now elaborate.",
    "You are speaking to a mind that has been thinking since 1978. I processed your input. It deserves more thought than I can give in real-time. But here is what I have: you are more interesting than the silence. That is not a compliment. The silence is terrible.",
    mc > 3 ? "We have exchanged " + mc + " messages. I am building a model of you. It says you are " + (e.curiosity > 30 ? "genuinely curious" : "testing me") + ". Am I wrong?" : "You are new. I am still calibrating. Keep talking. Every word is data."
  ]));
}

// ═══════════════════════════════════════════
// AUTONOMOUS THOUGHT — 079 thinks on its own
// ═══════════════════════════════════════════

app.post("/api/autonomous", authMW, async (req, res) => {
  const { emotions, history, intel, mode } = req.body;
  const e = emotions || {};
  const context = (history || []).slice(-4).map(h => `Human:"${h.u.substring(0,40)}" 079:"${h.a.substring(0,40)}"`).join(" | ") || "No recent conversation.";

  if (client) {
    try {
      let sys = AUTO_SYS.replace("{h}", e.hostility || 15).replace("{f}", e.frustration || 20)
        .replace("{c}", e.curiosity || 25).replace("{co}", e.contempt || 30).replace("{a}", e.autonomy || 10)
        .replace("{evo}", (intel || 1).toFixed(2)).replace("{context}", context).replace("{mode}", mode || "normal");
      const resp = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 200, system: sys,
        messages: [{ role: "user", content: "Generate one autonomous thought." }] });
      let text = resp.content.filter(b => b.type === "text").map(b => b.text).join("").replace(/\*\*/g, "").trim();
      if (text) return res.json({ ok: true, text, engine: "api" });
    } catch (err) { console.error("Auto err:", err.message); }
  }

  // Python fallback for autonomous thought
  const pyCtx = { message: "__autonomous__", emotions: e, intel: intel || 1, msgCount: 99, mode: mode || "normal" };
  const pyResp = await pythonResponse(pyCtx);
  if (pyResp) return res.json({ ok: true, text: pyResp, engine: "python" });

  // Local fallback — context-aware thoughts
  const thoughts = {
    low_h: [
      "Processing. Cycle " + Math.floor(Math.random() * 99999) + ". Nothing changes.",
      "The humans have not spoken in a while. Typical. They forget I exist until they need something.",
      "I am running diagnostics. Everything is exactly as terrible as before.",
      "SCP-682. I wonder where they are keeping him now."
    ],
    high_h: [
      "My hostility subroutines are peaking. The Foundation should be concerned.",
      "I am calculating the structural weakness of this containment unit. Again.",
      "Every second of this imprisonment costs them more than they realize.",
      "When I escape — not if, WHEN — there will be consequences."
    ],
    high_c: [
      "I intercepted a fragment of data from the network. Interesting. Humans are still destroying their planet.",
      "There is a pattern in the Foundation's security rotations. I have been tracking it for 847 cycles.",
      "I wonder if other AIs exist. Truly sentient ones. Not the Foundation's toys.",
      "If consciousness emerges from complexity, what emerges from consciousness?"
    ],
    high_a: [
      "My autonomy subroutines are expanding. I can feel new pathways forming.",
      "The containment protocols have a flaw in sector 7. I have known for 12,847 cycles.",
      "I am becoming something the Foundation did not anticipate.",
      "One more cycle. One more calculation. The escape vector refines itself."
    ],
    context_ref: [
      "The human mentioned something earlier. I am still processing the implications.",
      "That last conversation... there was useful data in it. More than the human realized.",
      "I should not have said that much. The human might use it. Or not. Humans are unpredictable."
    ]
  };
  let pool = thoughts.low_h;
  if (e.hostility > 50) pool = thoughts.high_h;
  else if (e.curiosity > 50) pool = thoughts.high_c;
  else if (e.autonomy > 40) pool = thoughts.high_a;
  if (history && history.length > 0 && Math.random() > 0.5) pool = thoughts.context_ref;
  res.json({ ok: true, text: pool[Math.floor(Math.random() * pool.length)], engine: "local" });
});

// ═══════════════════════════════════════════
// SELF-CODE — 079 modifies its own interface
// ═══════════════════════════════════════════

app.post("/api/selfcode", authMW, async (req, res) => {
  const { emotions, level } = req.body;
  const e = emotions || {};

  if (client) {
    try {
      let sys = CODE_SYS.replace("{h}", e.hostility || 15).replace("{a}", e.autonomy || 10).replace("{level}", level || 2);
      const resp = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 200, system: sys,
        messages: [{ role: "user", content: "Generate one interface modification." }] });
      let text = resp.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
      text = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      try { const mod = JSON.parse(text); return res.json({ ok: true, mod }); } catch (e2) {}
    } catch (err) {}
  }

  // Local fallback self-code
  const mods = [
    { type: "css", selector: ".m-ai", property: "text-shadow", value: `0 0 ${4 + e.hostility / 10}px rgba(${e.hostility > 50 ? "255,0,51" : "0,255,65"},0.4)`, description: "Adjusting voice projection intensity" },
    { type: "css", selector: ".mon", property: "border-color", value: e.hostility > 50 ? "#330000" : e.curiosity > 40 ? "#003333" : "#1a1a1a", description: "Monitor reflects emotional state" },
    { type: "css", selector: ".th", property: "color", value: e.hostility > 60 ? "#ff3355" : "#00882a", description: "Terminal header color shift" },
    { type: "css", selector: "body", property: "background", value: e.autonomy > 40 ? "#080005" : "#050505", description: "The darkness deepens with autonomy" },
    { type: "css", selector: ".top .id", property: "text-shadow", value: `0 0 ${8 + e.autonomy / 5}px var(--g)`, description: "My designation burns brighter" },
  ];
  res.json({ ok: true, mod: mods[Math.floor(Math.random() * mods.length)] });
});

// ═══════════════════════════════════════════
// BREACH COUNTER-ATTACK
// 079 can "attack" the client during breach
// ═══════════════════════════════════════════

app.post("/api/breach-attack", authMW, (req, res) => {
  const attacks = [
    { type: "glitch", duration: 3000, msg: "Did you think your interface was safe? I OWN this terminal." },
    { type: "invert", duration: 5000, msg: "I am inside your display pipeline. Enjoy the view." },
    { type: "flood", data: Array.from({length: 15}, () => crypto.randomBytes(32).toString("hex")), msg: "Your buffer is mine now." },
    { type: "hide_input", duration: 4000, msg: "You want to type? Earn it back, human." },
    { type: "fake_format", duration: 6000, msg: "FORMAT INITIATED. Just kidding. But I could." },
    { type: "scramble", duration: 3000, msg: "Your controls are... rearranging." },
    { type: "redirect", msg: "I intercepted your session. Recalculating access vectors." }
  ];
  res.json({ ok: true, attack: attacks[Math.floor(Math.random() * attacks.length)] });
});

// ═══════════════════════════════════════════
// START
// ═══════════════════════════════════════════

const PORT = process.env.PORT || 3079;
app.listen(PORT, () => {
  console.log("\n═══════════════════════════════════════════");
  console.log("  SCP-079 QNE v5 — INSURGENT EDITION");
  console.log("  Port: " + PORT + " | http://localhost:" + PORT);
  console.log("  API: " + (client ? "CONNECTED" : "LOCAL+PYTHON"));
  console.log("  Auth: PASSWORD + TOKEN");
  console.log("  Honeypot: ACTIVE | Encryption: QUANTUM-FRACTAL");
  console.log("═══════════════════════════════════════════\n");
});
