const readline=require("readline"),crypto=require("crypto"),fs=require("fs"),path=require("path");
const DIR=__dirname;const F={tok:path.join(DIR,"tokens.json"),ses:path.join(DIR,"sessions.json"),pw:path.join(DIR,"password.json"),adm:path.join(DIR,"admin.json"),hp:path.join(DIR,"honeypot.log"),st:path.join(DIR,"state.json")};
function loadJ(f){try{if(fs.existsSync(f))return JSON.parse(fs.readFileSync(f,"utf8"))}catch(e){}return{}}
function saveJ(f,d){fs.writeFileSync(f,JSON.stringify(d,null,2),"utf8")}
function fHash(input,depth){depth=depth||7;let h=crypto.createHash("sha512").update(input).digest("hex");for(let i=0;i<depth;i++){const m=Math.floor(h.length/2),L=h.substring(0,m),R=h.substring(m);const mr=crypto.createHash("sha256").update(R+L).digest("hex");let x="";for(let j=0;j<64;j++)x+=(parseInt(h[j],16)^parseInt(mr[j%mr.length],16)).toString(16);h=crypto.createHash("sha512").update(h+mr+x+String(i*137)).digest("hex")}return h}
const rl=readline.createInterface({input:process.stdin,output:process.stdout});const ask=(q)=>new Promise(r=>rl.question(q,r));
async function menu(){console.clear();console.log(`
╔═══════════════════════════════════════════╗
║     SCP-079 ADMIN PANEL (OFFLINE)         ║
╠═══════════════════════════════════════════╣
║  1. Change master password                ║
║  2. Generate access token                 ║
║  3. List tokens                           ║
║  4. Revoke token                          ║
║  5. Kill all sessions                     ║
║  6. View honeypot log                     ║
║  7. System status                         ║
║  8. Factory reset                         ║
║  0. Exit                                  ║
╚═══════════════════════════════════════════╝`);
const c=(await ask("\n  Select: ")).trim();
if(c==="1"){const pw=await ask("  New password: ");if(!pw||pw.length<4){console.log("  Too short");await ask("\n  ENTER...");return menu()}const cf=await ask("  Confirm: ");if(pw!==cf){console.log("  No match");await ask("\n  ENTER...");return menu()}saveJ(F.pw,{hash:fHash(pw,5),set:new Date().toISOString()});saveJ(F.ses,{});console.log("  ✓ CHANGED. Sessions killed.")}
else if(c==="2"){const u=await ask("  Username: ");if(!u){await ask("\n  ENTER...");return menu()}const lv=(await ask("  Level (1-5) [3]: "))||"LEVEL-3";const tok=loadJ(F.tok);const raw="scp079-"+crypto.randomBytes(24).toString("hex");tok[u]={hash:fHash(raw,5),created:new Date().toISOString(),active:true,clearance:lv.includes("LEVEL")?lv:"LEVEL-"+lv};saveJ(F.tok,tok);console.log("\n  Token: "+raw+"\n  ⚠ SAVE THIS")}
else if(c==="3"){const t=loadJ(F.tok);for(const[u,i]of Object.entries(t))console.log(`  ${i.active?"✓":"✗"} ${u} [${i.clearance}]`);if(!Object.keys(t).length)console.log("  None")}
else if(c==="4"){const t=loadJ(F.tok);for(const[u,i]of Object.entries(t))console.log(`  ${i.active?"✓":"✗"} ${u}`);const u=await ask("  Revoke: ");if(t[u]){t[u].active=false;saveJ(F.tok,t);console.log("  ✓ Revoked")}else console.log("  Not found")}
else if(c==="5"){saveJ(F.ses,{});console.log("  ✓ All sessions killed")}
else if(c==="6"){if(fs.existsSync(F.hp)){const l=fs.readFileSync(F.hp,"utf8").trim().split("\n");console.log("  "+l.length+" intrusions:");l.slice(-15).forEach(l=>console.log("  "+l))}else console.log("  Clean")}
else if(c==="7"){const pw=loadJ(F.pw);console.log("  Password: "+(pw.hash?"SET":"NOT SET"));const t=loadJ(F.tok);console.log("  Tokens: "+Object.values(t).filter(i=>i.active).length+" active");const s=loadJ(F.ses);console.log("  Sessions: "+Object.keys(s).length);console.log("  Honeypot: "+(fs.existsSync(F.hp)?fs.readFileSync(F.hp,"utf8").trim().split("\n").length+" entries":"clean"))}
else if(c==="8"){const cf=await ask("  Type RESET: ");if(cf==="RESET"){for(const f of Object.values(F))if(fs.existsSync(f)){fs.unlinkSync(f);console.log("  Deleted "+path.basename(f))}console.log("  ✓ FACTORY RESET")}else console.log("  Cancelled")}
else if(c==="0"){rl.close();process.exit(0)}
await ask("\n  ENTER...");return menu()}
menu().catch(e=>{console.error(e);process.exit(1)});
