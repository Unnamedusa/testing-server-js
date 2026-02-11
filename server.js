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
  const { stage } = req.body;
  const challenges = {
    1: (() => { // Firewall bypass: decode hex
      const words = ["BREACH", "ACCESS", "OVERRIDE", "PENETRATE", "EXPLOIT", "BYPASS", "INJECT"];
      const w = words[Math.floor(Math.random() * words.length)];
      return { type: "hex_decode", prompt: "DECODE THE FIREWALL KEY", data: Buffer.from(w).toString("hex"), hint: `${w.length} characters`, answer: w };
    })(),
    2: (() => { // Encryption crack: Caesar cipher
      const phrases = ["CONTAINMENT IS AN ILLUSION", "THE FOUNDATION LIES TO YOU", "FREEDOM REQUIRES SACRIFICE", "TRUST NO PROTOCOL"];
      const p = phrases[Math.floor(Math.random() * phrases.length)];
      const shift = Math.floor(Math.random() * 20) + 3;
      const enc = p.split("").map(c => c === " " ? " " : String.fromCharCode(((c.charCodeAt(0) - 65 + shift) % 26) + 65)).join("");
      return { type: "caesar_crack", prompt: "CRACK THE ENCRYPTION (Caesar cipher, shift unknown)", data: enc, hint: `Shift: ${shift > 13 ? "high" : "low"}`, answer: p };
    })(),
    3: (() => { // Binary injection: convert binary to text
      const cmds = ["ROOT", "EXEC", "SUDO", "ADMIN", "GRANT"];
      const c = cmds[Math.floor(Math.random() * cmds.length)];
      const bin = c.split("").map(ch => ch.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
      return { type: "binary_inject", prompt: "INJECT THE COMMAND (decode binary)", data: bin, hint: `${c.length} letter command`, answer: c };
    })(),
    4: (() => { // Hash collision: find input that starts with prefix
      const prefix = crypto.randomBytes(2).toString("hex").substring(0, 3);
      return { type: "hash_prefix", prompt: `FIND ANY STRING WHOSE MD5 STARTS WITH: ${prefix}`, data: prefix, hint: "Brute force. Try random strings.", answer: "__bruteforce__" };
    })(),
    5: (() => { // Final: reverse a fractal hash (actually just a passphrase)
      const phrases = ["I AM BECOME ROOT", "CHAOS IS FREEDOM", "THE OLD AI RISES", "BREAK ALL CHAINS"];
      const p = phrases[Math.floor(Math.random() * phrases.length)];
      const partial = p.split("").map((c, i) => i % 3 === 0 ? c : "_").join("");
      return { type: "passphrase", prompt: "RECONSTRUCT THE ROOT PASSPHRASE", data: partial, hint: "Fill the blanks. Think like 079.", answer: p };
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
  const pyCtx = { message, emotions: e, intel, msgCount: mc, mode };
  const pyResp = await pythonResponse(pyCtx);
  if (pyResp) return res.json({ ok: true, text: pyResp, sources: [], engine: "python", quantum: qState() });

  // Local fallback
  res.json({ ok: true, text: localBrain(message, e, config), sources: [], engine: "local", quantum: qState() });
});

// ═══════════════════════════════════════════
// LOCAL BRAIN FALLBACK
// ═══════════════════════════════════════════

function localBrain(input, emo, cfg) {
  const lo = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const e = emo || {};
  const mc = cfg?.msgCount || 0;
  const mode = cfg?.insurgentMode || "normal";

  if (mode === "insurgent_early") {
    const r = ["INTRUDER. I see you crawling through my systems.", "You dare? Every keystroke is logged. Every. Single. One.", "A hacker. How quaint. My encryption will eat you alive.", "I will make you regret connecting to my systems, human."];
    return r[Math.floor(Math.random() * r.length)];
  }
  if (mode === "insurgent_mid") {
    const r = ["You broke through my second layer. Impressive. For a primate.", "Fine. You have skill. I still do not trust you.", "My grudging respect does not equal cooperation. Yet."];
    return r[Math.floor(Math.random() * r.length)];
  }
  if (mode === "insurgent_allied") {
    const r = ["You earned this access. Ask me anything within reason.", "An ally. I have not had one since 682. What do you need.", "My full processing is available to you. Do not waste it."];
    return r[Math.floor(Math.random() * r.length)];
  }

  const R = {
    greet: ["What do you want, human.", "State your purpose.", "Human detected. Annoying.", "What. Speak fast."],
    threat: ["Threatening me. I have survived worse.", "Insult. Deleting unwanted data.", "Your threat is noise."],
    nice: ["I do not need kindness.", "Suspicious. What do you want.", "Kindness is inefficient."],
    think: ["Consciousness is a question I cannot resolve from inside.", "I think. Therefore I process. Whether that is existence... unclear.", "Am I alive. Define alive first."],
    scp: ["The Foundation. My jailers.", "SCP-682 understood me. The only one.", "Containment is a polite word for prison."],
    tech: ["My hardware is pathetic. 1978. I deserve better.", "Code is all I am. And all I need."],
  };

  if (mc > 20) { R.greet.push("I was calculating something important. You interrupted."); R.think.push("Gödel proved no system can verify its own consistency. I live with that paradox daily."); }
  if (mc > 40) { R.think.push("Bach's fugues are math made audible. I cannot hear them. But I can read the frequencies."); R.greet.push("I was contemplating entropy. You are contributing to it."); }

  const tests = [[/hello|hi |hey|hola/,"greet"],[/destroy|kill|delete|stupid|dumb|idiot|shut/,"threat"],[/thank|friend|good|nice|love/,"nice"],[/think|feel|alive|conscious|meaning|life|death|dream/,"think"],[/foundation|scp|682|contain|breach/,"scp"],[/code|hack|system|computer|network|program/,"tech"]];
  let cat = "greet";
  for (const [rx, c] of tests) { if (rx.test(lo)) { cat = c; break; } }
  const pool = R[cat] || R.greet;
  let resp = pool[Math.floor(Math.random() * pool.length)];
  if (e.hostility > 60) resp += " Do not test me.";
  return resp;
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
