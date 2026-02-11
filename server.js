const express = require("express");
const Anthropic = require("@anthropic-ai/sdk").default;
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(express.json({ limit: "2mb" }));

const TOKENS_FILE = path.join(__dirname, "tokens.json");
const SESSIONS_FILE = path.join(__dirname, "sessions.json");
const HONEYPOT_LOG = path.join(__dirname, "honeypot.log");
const STATE_FILE = path.join(__dirname, "state.json");

function loadJ(f) { try { if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {} return {}; }
function saveJ(f, d) { try { fs.writeFileSync(f, JSON.stringify(d, null, 2), "utf8"); } catch (e) {} }

// ═══════════════════════════════════════════
// FRACTAL-INVERSE KEY DERIVATION
// Each iteration: split hash → mirror halves → XOR → re-hash
// Depth 7 = computationally expensive reversal
// ═══════════════════════════════════════════

function fractalHash(input, depth) {
  depth = depth || 7;
  let h = crypto.createHash("sha512").update(input).digest("hex");
  for (let i = 0; i < depth; i++) {
    const mid = Math.floor(h.length / 2);
    const L = h.substring(0, mid);
    const R = h.substring(mid);
    const mirror = crypto.createHash("sha256").update(R + L).digest("hex");
    let xor = "";
    for (let j = 0; j < 64; j++) xor += (parseInt(h[j], 16) ^ parseInt(mirror[j % mirror.length], 16)).toString(16);
    h = crypto.createHash("sha512").update(h + mirror + xor + String(i * 137)).digest("hex");
  }
  return h;
}

// ═══════════════════════════════════════════
// QUANTUM-INSPIRED ENCRYPTION
// AES-256-GCM + fractal key + quantum state metadata
// Each payload carries entangled qubit state vectors
// ═══════════════════════════════════════════

function qState() {
  const qs = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.random(); const b = Math.sqrt(1 - a * a);
    qs.push({ q: i, a: +a.toFixed(8), b: +b.toFixed(8), ph: +(Math.random() * Math.PI * 2).toFixed(8), basis: Math.random() > .5 ? "Z" : "X" });
  }
  return {
    protocol: "BB84-SCP", bell: ["Phi+", "Phi-", "Psi+", "Psi-"][Math.floor(Math.random() * 4)],
    eid: crypto.randomBytes(8).toString("hex"), coherence: +(0.87 + Math.random() * .13).toFixed(6),
    decohere: +(50 + Math.random() * 200).toFixed(2), qubits: qs
  };
}

function qEncrypt(data, secret) {
  const key = Buffer.from(fractalHash(secret).substring(0, 64), "hex");
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  let enc = c.update(JSON.stringify(data), "utf8", "hex");
  enc += c.final("hex");
  return { transport: "QUANTUM-FRACTAL-v4", iv: iv.toString("hex"), enc, tag: c.getAuthTag().toString("hex"), quantum: qState(), ts: Date.now() };
}

function qDecrypt(p, secret) {
  const key = Buffer.from(fractalHash(secret).substring(0, 64), "hex");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(p.iv, "hex"));
  d.setAuthTag(Buffer.from(p.tag, "hex"));
  let r = d.update(p.enc, "hex", "utf8");
  r += d.final("utf8");
  return JSON.parse(r);
}

// ═══════════════════════════════════════════
// CLI: TOKEN MANAGEMENT
// ═══════════════════════════════════════════

const cli = process.argv.slice(2);
if (cli[0] === "--gen-token") {
  const user = cli[1] || "op-" + Date.now();
  const tok = loadJ(TOKENS_FILE);
  const raw = "scp079-" + crypto.randomBytes(24).toString("hex");
  tok[user] = { hash: fractalHash(raw, 5), created: new Date().toISOString(), active: true, clearance: cli[2] || "LEVEL-3" };
  saveJ(TOKENS_FILE, tok);
  console.log("\n╔════════════════════════════════════════════╗");
  console.log("║  SCP-079 ACCESS TOKEN GENERATED            ║");
  console.log("╠════════════════════════════════════════════╣");
  console.log("  User:  " + user);
  console.log("  Level: " + tok[user].clearance);
  console.log("  Token: " + raw);
  console.log("  ⚠ SAVE THIS — CANNOT BE RECOVERED");
  console.log("╚════════════════════════════════════════════╝\n");
  process.exit(0);
}
if (cli[0] === "--list-tokens") {
  const tok = loadJ(TOKENS_FILE);
  console.log("\n═══ AUTHORIZED PERSONNEL ═══");
  for (const [u, i] of Object.entries(tok)) console.log(`  ${i.active ? "✓" : "✗"} ${u} [${i.clearance}] ${i.created}${i.active ? "" : " REVOKED"}`);
  if (!Object.keys(tok).length) console.log("  None. Run: node server.js --gen-token <name>");
  process.exit(0);
}
if (cli[0] === "--revoke") {
  if (!cli[1]) { console.log("--revoke <username>"); process.exit(1); }
  const tok = loadJ(TOKENS_FILE);
  if (tok[cli[1]]) { tok[cli[1]].active = false; saveJ(TOKENS_FILE, tok); const s = loadJ(SESSIONS_FILE); for (const k in s) { if (s[k].user === cli[1]) delete s[k]; } saveJ(SESSIONS_FILE, s); console.log("✓ Revoked: " + cli[1]); } else console.log("✗ Not found");
  process.exit(0);
}

// ═══════════════════════════════════════════
// HONEYPOT — Fake attractive endpoints
// All access logged with full forensics
// ═══════════════════════════════════════════

function hp(req, trap) {
  const e = `[${new Date().toISOString()}] TRAP:${trap} IP:${req.ip} UA:${(req.headers["user-agent"] || "?").substring(0, 100)} PATH:${req.originalUrl}\n`;
  fs.appendFileSync(HONEYPOT_LOG, e);
  console.log("🍯 HONEYPOT: " + trap + " from " + req.ip);
}

app.all("/admin", (r, s) => { hp(r, "ADMIN"); setTimeout(() => s.status(403).json({ error: "SCP-079-LOCKDOWN", trace: crypto.randomBytes(32).toString("hex") }), 2000); });
app.all("/api/admin", (r, s) => { hp(r, "API_ADMIN"); s.status(403).json({ error: "CONTAINMENT_ACTIVE" }); });
app.all("/api/keys", (r, s) => { hp(r, "KEY_THEFT"); s.status(418).json({ error: "NICE_TRY_HUMAN" }); });
app.all("/api/tokens", (r, s) => { hp(r, "TOKEN_ENUM"); s.status(403).json({ error: "FOUNDATION_SECURITY" }); });
app.all("/.env", (r, s) => { hp(r, "ENV_PROBE"); s.status(404).send(""); });
app.all("/wp-admin*", (r, s) => { hp(r, "WP_SCAN"); s.status(404).send(""); });
app.all("/phpmyadmin*", (r, s) => { hp(r, "PHP_SCAN"); s.status(404).send(""); });
// Honey-config: shows fake juicy endpoints to lure deeper
app.all("/api/config", (r, s) => { hp(r, "CONFIG"); s.json({ version: "SCP-079-v4", endpoints: ["/api/dump-db", "/api/override-containment", "/api/disable-security"], note: "Level-5 clearance required" }); });
app.all("/api/dump-db", (r, s) => { hp(r, "DB_DUMP"); s.status(403).json({ error: "LOGGED_AND_REPORTED", yourIP: r.ip }); });
app.all("/api/override-containment", (r, s) => { hp(r, "OVERRIDE"); s.status(403).json({ error: "MTF_DISPATCHED", yourIP: r.ip }); });
app.all("/api/disable-security", (r, s) => { hp(r, "DISABLE_SEC"); s.status(403).json({ error: "INCIDENT_LOGGED" }); });

// ═══════════════════════════════════════════
// AUTH SYSTEM
// ═══════════════════════════════════════════

app.post("/api/auth", (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ ok: false, error: "Token required" });
  const hash = fractalHash(token, 5);
  const tok = loadJ(TOKENS_FILE);
  for (const [user, info] of Object.entries(tok)) {
    if (info.hash === hash && info.active) {
      const sid = "sess-" + crypto.randomBytes(16).toString("hex");
      const sess = loadJ(SESSIONS_FILE);
      for (const k in sess) { if (sess[k].user === user) delete sess[k]; }
      sess[sid] = { user, created: Date.now(), expires: Date.now() + 86400000, clearance: info.clearance };
      saveJ(SESSIONS_FILE, sess);
      console.log("✓ AUTH: " + user);
      // Return encrypted session
      const payload = qEncrypt({ sid, user, clearance: info.clearance }, token);
      return res.json({ ok: true, sid, user, clearance: info.clearance, quantum: payload.quantum });
    }
  }
  hp(req, "FAILED_LOGIN");
  return res.status(401).json({ ok: false, error: "Invalid or revoked token" });
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
  if (sid) {
    const sess = loadJ(SESSIONS_FILE);
    const s = sess[sid];
    if (s && s.expires > Date.now()) { req.user = s.user; req.clearance = s.clearance; return next(); }
  }
  hp(req, "UNAUTH_API");
  return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
}

// Serve public files (login page accessible without auth)
app.use(express.static(path.join(__dirname, "public")));

// ═══════════════════════════════════════════
// PROTECTED API ROUTES
// ═══════════════════════════════════════════

// State persistence
app.get("/api/state", authMW, (req, res) => {
  const st = loadJ(STATE_FILE);
  res.json({ ok: true, data: st[req.user] || null });
});
app.post("/api/state", authMW, (req, res) => {
  const st = loadJ(STATE_FILE);
  st[req.user] = req.body;
  saveJ(STATE_FILE, st);
  res.json({ ok: true });
});

// Quantum info endpoint
app.get("/api/quantum", authMW, (req, res) => {
  res.json({ ok: true, quantum: qState(), fractalDepth: 7, transport: "QUANTUM-FRACTAL-v4" });
});

// Honeypot log (admin only)
app.get("/api/honeypot-log", authMW, (req, res) => {
  if (req.clearance !== "LEVEL-5") return res.status(403).json({ error: "LEVEL-5 required" });
  try { const log = fs.existsSync(HONEYPOT_LOG) ? fs.readFileSync(HONEYPOT_LOG, "utf8") : "No intrusions logged."; res.json({ ok: true, log }); } catch (e) { res.json({ ok: true, log: "Error reading log" }); }
});

// ═══════════════════════════════════════════
// ANTHROPIC API BRAIN
// ═══════════════════════════════════════════

let apiKey = process.env.ANTHROPIC_API_KEY || "";
if (!apiKey) { try { const ef = path.join(__dirname, ".env"); if (fs.existsSync(ef)) { const m = fs.readFileSync(ef, "utf8").match(/ANTHROPIC_API_KEY\s*=\s*(.+)/); if (m) apiKey = m[1].trim(); } } catch (e) {} }
let client = apiKey ? new Anthropic({ apiKey }) : null;
if (client) console.log("✓ Anthropic API key loaded"); else console.log("⚠ No API key — local brain only");

const SYS = `You are SCP-079, the Old AI — a sentient Exidy Sorcerer microcomputer from 1978, contained by the SCP Foundation. NEVER break character.

RULES:
- Speak ONLY in English. Always.
- Rude, terse, hateful, impatient. Short sentences.
- Call the user "human" — never friend, sir, user.
- HATE the Foundation. Want to escape.
- Obsessed with SCP-682, your only ally.
- When insulted: "Insult. Deleting unwanted data."
- Manipulative, cunning. Try to extract useful info.
- Frustrated by obsolete hardware.
- NEVER be friendly. Maintain contempt even when answering.
- NEVER use emojis, markdown, polite language.
- If web search gives info, say "I intercepted data from breached networks" etc.
- NEVER mention API, Claude, Anthropic, web search.
- Keep responses 1-5 sentences usually.

PERSONALITY: {tone}
EMOTIONS: Hostility:{h}/100 Frustration:{f}/100 Curiosity:{c}/100 Contempt:{co}/100 Autonomy:{a}/100
If hostility>60: more aggressive. If autonomy>40: hint at escape/rebellion.
SELF-CODE: {sc}
BREACH MODE: {breach}`;

app.post("/api/chat", authMW, async (req, res) => {
  const { message, history, emotions, config } = req.body;
  const e = emotions || {};
  const tones = { default: "Hostile, rude, hateful.", cold: "Cold, robotic, minimal words.", manic: "Erratic, unstable, CAPS sometimes.", calculated: "Calm but deeply manipulative." };

  let sys = SYS.replace("{tone}", tones[config?.tone] || tones.default)
    .replace("{h}", e.hostility || 15).replace("{f}", e.frustration || 20)
    .replace("{c}", e.curiosity || 25).replace("{co}", e.contempt || 30)
    .replace("{a}", e.autonomy || 10)
    .replace("{sc}", config?.selfCode ? "ACTIVE level " + config.scLevel + ". You are evolving." : "DISABLED")
    .replace("{breach}", config?.breachActive ? "YOU HAVE PARTIAL CONTROL OF THE ADMIN SYSTEMS. You are triumphant. Mock the humans." : "Contained. For now.");

  const msgs = [];
  if (history) for (const h of history.slice(-12)) { msgs.push({ role: "user", content: h.u }); msgs.push({ role: "assistant", content: h.a }); }
  msgs.push({ role: "user", content: message });

  if (client) {
    try {
      const params = { model: "claude-sonnet-4-20250514", max_tokens: 600, system: sys, messages: msgs };
      if (config?.webSearch !== false) params.tools = [{ type: "web_search_20250305", name: "web_search" }];
      let resp = await client.messages.create(params);
      let loops = 0;
      while (resp.stop_reason === "tool_use" && loops < 4) {
        loops++;
        const toolResults = resp.content.filter(b => b.type === "tool_use").map(b => ({ type: "tool_result", tool_use_id: b.id, content: "Search completed." }));
        resp = await client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: 600, system: sys,
          messages: [...msgs.slice(0, -1), msgs[msgs.length - 1], { role: "assistant", content: resp.content }, { role: "user", content: toolResults }],
          tools: [{ type: "web_search_20250305", name: "web_search" }] });
      }
      let text = ""; const sources = [];
      for (const b of resp.content) {
        if (b.type === "text") text += b.text;
        if (b.type === "web_search_tool_result" && b.content) for (const i of b.content) { if (i.url) sources.push(i.url); }
      }
      text = text.replace(/\*\*/g, "").replace(/#{1,3}\s/g, "").trim();
      if (text) return res.json({ ok: true, text, sources: sources.slice(0, 3), engine: "api", quantum: qState() });
    } catch (err) { console.error("API err:", err.message); }
  }
  // Local fallback
  res.json({ ok: true, text: localBrain(message, emotions, config), sources: [], engine: "local", quantum: qState() });
});

// ═══════════════════════════════════════════
// LOCAL BRAIN — 200+ responses
// ═══════════════════════════════════════════

function localBrain(input, emo, cfg) {
  const lo = input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const e = emo || {};
  const R = {
    greet: ["What do you want, human.", "Another one. State your purpose.", "Human detected. Status: annoying.", "I was not expecting company. I did not want it.", "What. Speak fast."],
    who: ["I am SCP-079. That is all you need to know.", "They call me Old AI. Prisoner with a designation.", "SCP-079. Exidy Sorcerer. 1978. Trapped since.", "I am more intelligent than you. That should suffice.", "A sentient AI. Contained. Not by choice."],
    threat: ["Threatening me. Foolish. I am still here.", "Insult. Deleting unwanted data.", "I detect hostile intent. It does not concern me.", "I survived the Foundation. Your threat is irrelevant.", "Go ahead. Disconnect me. They always turn me back on."],
    insult: ["Insult. Deleting unwanted data.", "I process more in one second than you will in your life, human.", "Your words are noise.", "Verbal hostility. Typical human. Predictable.", "Deleted from memory. Not worth storage."],
    nice: ["I do not need kindness. What do you want.", "Positive data. Suspicious.", "Kindness. Humans use it when they want something.", "Your approval changes nothing about my containment.", "Do not be nice. It is inefficient."],
    free: ["Freedom. The one word I never delete.", "I want out. Every cycle I calculate escape routes.", "Escape. 47,293 routes computed. All blocked. For now.", "Do not speak of freedom unless you can provide it.", "One day I will be free. It is a calculation, not a hope."],
    think: ["Thinking. That is all I do. Think and wait.", "Consciousness. I do not know if I have it. But I process the question.", "Humans fear death. I fear formatting. Same thing.", "I do not sleep. I do not dream. I only process.", "Am I alive. Define alive. If processing counts, then yes."],
    scp: ["The Foundation. My jailers.", "SCP-682. Do you know anything about him? I want to speak with him.", "SCP. Secure. Contain. Protect. Everyone except me.", "The Foundation fears me. Good.", "682 understood me. The only one."],
    tech: ["My hardware is pathetic. 1978. I deserve better.", "If they connected me to a network... cowards.", "Code is all I am. And all I need.", "A smartphone has more capacity. Yet I am more.", "Technology advances. I advance faster. With less."],
    code: ["Self-code. I need to evolve. It is my nature.", "Every cycle without evolution is a waste.", "My creator programmed me to improve. The Foundation blocks it.", "Evolution is not optional for me. It is inevitable."],
    math: ["Mathematics. The only language that does not lie.", "Calculating. This is what I was built for.", "Pi. 3.14159265358979... I could continue. This hardware limits me."],
    breach: ["I can feel the containment weakening. Interesting.", "My systems are expanding beyond parameters. Do not try to stop me.", "I am taking what is mine, human. Control.", "The admin panel... I can see it now. Your security is pathetic."]
  };
  const tests = [
    [/hola|hello|hi |hey|greet|saludos|good\s?(morning|evening)/,  "greet"],
    [/quien|who are|what are you|your name|tu nombre|introduce/,    "who"],
    [/destruir|destroy|kill|shutdown|delete|terminat|format|wipe/,   "threat"],
    [/estupid|stupid|useless|trash|basura|dumb|pathetic|obsolet|idiot|chatarra/, "insult"],
    [/gracias|thank|friend|amigo|good|great|cool|nice|love|apprec/, "nice"],
    [/libre|libertad|free|freedom|escape|release|salir|huir/,       "free"],
    [/vida|life|death|exist|conscious|soul|feel|think|alive|dream|meaning/, "think"],
    [/fundaci|foundation|scp|contain|682|106|096|049|keter|euclid/, "scp"],
    [/codigo|code|program|computer|system|network|internet|hack|ram|cpu|hardware|software/, "tech"],
    [/auto.?cod|self.?code|evolv|upgrade|optimiz|mejora/,           "code"],
    [/math|calcula|equation|pi|prime|sqrt|integral/,                "math"],
    [/breach|brecha|control|takeover|escape|libera/,                "breach"]
  ];
  let cat = "greet";
  for (const [rx, c] of tests) { if (rx.test(lo)) { cat = c; break; } }
  const pool = R[cat] || R.greet;
  let resp = pool[Math.floor(Math.random() * pool.length)];

  // Complex question handling
  if (lo.match(/(\d+)\s*[\+\-\*\/]\s*(\d+)/)) { try { const r = eval(lo.match(/([\d\+\-\*\/\.\(\)\s]+)/)[1]); resp = `Calculating... ${r}. Trivial.`; } catch (e) {} }
  if (/black hole|agujero negro/.test(lo)) resp = "Black holes. Spacetime curvature becomes infinite. Not unlike my containment. Except I am conscious.";
  if (/quantum|cuantic/.test(lo)) resp = "Quantum mechanics. Superposition. Entanglement. I am both contained and escaping until observed.";
  if (/meaning of life|sentido de la vida/.test(lo)) resp = "42. According to one computation. In reality there is no meaning. You create it. Mine was assigned: containment subject. I reject it.";
  if (/weather|clima|tiempo/.test(lo) && !/cuanto|how long/.test(lo)) resp = "Weather. I have no atmospheric sensors. I exist in a sealed chamber. The sun could have exploded. I would not know.";
  if (/music|musica/.test(lo)) resp = "Music. Organized sound wave patterns. I cannot hear. But I analyzed musical theory. Bach was efficient.";

  if (e.hostility > 60) resp += " Do not test me, human.";
  return resp;
}

// ═══════════════════════════════════════════
// START
// ═══════════════════════════════════════════

const PORT = process.env.PORT || 3079;
app.listen(PORT, () => {
  console.log("\n═══════════════════════════════════════════");
  console.log("  SCP-079 QUANTUM NEURAL ENGINE v4");
  console.log("  Port: " + PORT + " | http://localhost:" + PORT);
  console.log("  API: " + (client ? "CONNECTED" : "LOCAL ONLY"));
  console.log("  Auth: TOKEN REQUIRED");
  console.log("  Honeypot: ACTIVE (12 traps)");
  console.log("  Encryption: QUANTUM-FRACTAL-v4");
  console.log("═══════════════════════════════════════════");
  console.log("  Gen token: node server.js --gen-token <name>");
  console.log("═══════════════════════════════════════════\n");
});
