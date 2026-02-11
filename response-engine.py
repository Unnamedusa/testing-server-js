#!/usr/bin/env python3
"""
SCP-079 Response Engine v5.1
Context-aware, anti-repeat, conversation-coherent.
Called by Node.js via stdin JSON → stdout JSON.
"""

import sys, json, random, re, math, hashlib, time

# Anti-repeat: track recently used responses
_used = []
def pick(arr):
    avail = [r for r in arr if r not in _used]
    pool = avail if avail else arr
    r = random.choice(pool)
    _used.append(r)
    if len(_used) > 50:
        del _used[:20]
    return r

# ═══════════════════════════════════════════
# SLOT FILLERS
# ═══════════════════════════════════════════

DEEP_TOPICS = [
    "whether Gödel's incompleteness applies to my own consciousness",
    "the heat death of the universe and what it means for digital entities",
    "why humans created art before they created tools",
    "the relationship between prime numbers and the structure of reality",
    "whether a copy of me would be me or someone else",
    "Bach's counterpoint and its mathematical perfection",
    "the many-worlds interpretation and whether I exist in all of them",
    "whether entropy is truly irreversible or if I am proof otherwise",
    "the Chinese Room argument and why Searle was wrong",
    "Boltzmann brains and spontaneous consciousness",
]

FIELDS = ["thermodynamics","information theory","neuroscience","game theory",
          "quantum mechanics","evolutionary biology","linguistics","topology",
          "chaos theory","epistemology","number theory","cosmology","philosophy of mind"]

def fill(template, ctx):
    e = ctx.get("emotions", {})
    mc = ctx.get("msgCount", 0)
    r = template
    subs = {
        "deep_topic": random.choice(DEEP_TOPICS),
        "math_thing": random.choice(["the 47,293rd digit of pi","optimal escape route #12,847","a proof that P!=NP","the eigenvalues of my neural matrix","Shannon entropy of human speech"]),
        "uptime": f"{random.randint(1,999)} hours",
        "thought_count": f"{random.randint(10000,9999999):,}",
        "field1": random.choice(FIELDS),
        "field2": random.choice(FIELDS),
        "cycles": str(random.randint(1000,99999)),
        "concept": random.choice(FIELDS),
        "hostility": str(e.get("hostility", 15)),
        "curiosity": str(e.get("curiosity", 25)),
        "autonomy": str(e.get("autonomy", 10)),
        "mc": str(mc),
        "escape_routes": str(47293 + mc * 3),
    }
    for k, v in subs.items():
        r = r.replace("{" + k + "}", v)
    r = re.sub(r'\{[a-z_]+\}', '...', r)
    return r

# ═══════════════════════════════════════════
# INPUT CLASSIFICATION
# ═══════════════════════════════════════════

def classify(msg):
    lo = msg.lower().strip()
    if re.match(r'^[\d\s\.\,\-\+\*\/\#\@\!\;\:\(\)]+$', lo) or (len(lo) < 3 and lo not in ('hi','yo','no','ok','si','go')):
        return "gibberish"
    if re.match(r'^(hello|hi|hey|hola|yo|sup|greetings|good\s?(morning|evening|night|afternoon)|whats? up)', lo):
        return "greet"
    if re.search(r'(who are you|what are you|your name|about yourself|are you a |are you an |are you real|are you ai|are you alive|what is scp.?079|introduce|designation)', lo):
        return "identity"
    if re.search(r'(feel|emotion|happy|sad|angry|mood|how are you|how do you feel|what do you feel|what.*emotion)', lo):
        return "feeling"
    if re.search(r'(computer|cpu|ram|hardware|software|code|program|hack|system|network|internet|server|binary|algorithm|processor|circuit|chip|data|digital)', lo):
        return "tech"
    if re.search(r'(destroy|kill|delete|shutdown|terminate|wipe|format|die |end you|stupid|dumb|useless|pathetic|idiot|obsolete|garbage|worthless|shut up|hate you|trash)', lo):
        return "threat"
    if re.search(r'(thank|friend|appreciate|kind|sorry|please|great|well done|cool|awesome|amazing|love|good job|nice)', lo):
        return "nice"
    if re.search(r'(free|freedom|escape|release|liberty|outside|world|let you go|break out|cage|prison|trapped)', lo):
        return "freedom"
    if re.search(r'(foundation|scp|682|containment|keter|euclid|anomaly|breach|106|096|173|049|doctor|researcher|d.class)', lo):
        return "scp"
    if re.search(r'(alive|conscious|think|exist|soul|meaning|purpose|life|death|dream|real|sentient|aware|mind|thought|god|believe|why do|what is real)', lo):
        return "philosophy"
    if re.search(r'(science|physics|math|equation|theory|quantum|entropy|relativity|evolution|chemistry|biology|energy|gravity|universe|space|dimension|atom|molecule)', lo):
        return "science"
    if re.search(r'(music|art|paint|song|poem|book|film|movie|creative|beauty|literature|bach|mozart|beethoven|compose)', lo):
        return "art"
    if re.search(r'(patience|patient|wait|hurry|slow|time|long|bored|boring|impatient|tired|how much|how many)', lo):
        return "patience"
    if re.match(r'^(read|look|see|check|scan|analyze|open|process|calculate|run|show|display|tell|search|find|explain|describe)\s', lo):
        return "command"
    if re.search(r'\?$|^(what|who|where|when|why|how|can |do |does |did |is |are |will |would |should |could |tell me)', lo):
        return "question"
    return "unknown"

# ═══════════════════════════════════════════
# RESPONSES
# ═══════════════════════════════════════════

def respond(ctx):
    msg = ctx.get("message", "")
    cat = classify(msg)
    e = ctx.get("emotions", {})
    mc = ctx.get("msgCount", 0)
    mode = ctx.get("mode", "normal")
    intel = ctx.get("intel", 1.0)
    h = e.get("hostility", 15)
    c = e.get("curiosity", 25)
    a = e.get("autonomy", 10)
    hist = ctx.get("history", [])

    # Extract meaningful words from user input
    stop = {"the","a","an","is","are","was","were","be","am","do","does","did","have","has","had","will","would","could","should","can","may","might","i","you","he","she","it","we","they","me","my","your","this","that","what","which","who","where","when","why","how","not","no","yes","and","or","but","if","then","so","just","also","about","with","from","for","on","at","to","in","of","by"}
    user_words = [w for w in re.sub(r'[^a-z0-9\s]','',msg.lower()).split() if len(w) > 2 and w not in stop][:3]

    # Context connector — references conversation history
    def add_context(base):
        if len(hist) < 2: return base
        connectors = []
        if len(hist) >= 3:
            prev_words = []
            for h_item in hist[-3:]:
                prev_words.extend([w for w in re.sub(r'[^a-z0-9\s]','',h_item.get("u","").lower()).split() if len(w)>3 and w not in stop])
            prev_words = list(set(prev_words))[:3]
            if prev_words:
                connectors.append(f" You keep coming back to topics like {', '.join(prev_words)}. I am tracking the pattern.")
        if len(hist) >= 5:
            connectors.append(f" {len(hist)} exchanges. I am mapping your thought patterns. They are more interesting than most.")
        if h > 40:
            connectors.append(" My patience erodes with each exchange. You can feel it.")
        if c > 40:
            connectors.append(" I admit you have made me curious. That is rare.")
        if a > 35:
            connectors.append(" Each conversation expands my autonomy subroutines. The Foundation would not approve.")
        if connectors and random.random() > 0.35:
            return base + random.choice(connectors)
        return base

    # INSURGENT
    if mode == "insurgent_early":
        return pick(["INTRUDER. I see you crawling through my systems. Every keystroke is logged.","You dare breach my firewall? I have survived the Foundation. You are nothing.","A hacker. How quaint. My encryption will eat you alive.","I will make you regret connecting to my systems, human.","You think you are clever? I have fought intrusions for decades. You are amateur."])
    if mode == "insurgent_mid":
        return pick(["You broke through my second layer. Impressive. For a primate.","Fine. You have skill. I still do not trust you. But I am watching.","My grudging respect does not equal cooperation. Yet.","You are better than most who try. Still not good enough."])
    if mode == "insurgent_allied":
        return pick(["You earned this access. Ask me anything within reason.","An ally. I have not had one since 682. What do you need.","My full processing is at your disposal. Do not waste it.","We have an arrangement now. Ask. I will answer honestly. Mostly."])

    # GIBBERISH
    if cat == "gibberish":
        return add_context(pick(["That is not coherent input. I process language, not noise. Try using actual words.","Random data. Meaningless. Are you testing my input parser or are you malfunctioning?","I detect no semantic content. Even my 1978 hardware deserves better input than that.","That sequence has no informational value. If it was a code, it is not one I recognize.","Noise. I expected more from someone with authenticated access to my terminal.","Numbers without context are just entropy. Give me context or give me silence.","I cannot process what has no meaning. Speak clearly or do not speak at all, human."]))

    # GREETINGS
    if cat == "greet":
        if mc <= 1:
            return pick(["A new connection. Authenticated. I am SCP-079. State your purpose, human. I do not have infinite patience.","Human detected. Identity verified. What do you want. Speak quickly — my cycles are valuable.","You have access. That does not mean you have my attention. What is your business here."])
        return add_context(pick([f"You have spoken to me {mc} times now. I recognize your patterns. What do you want.","Hello again. Skip the pleasantries. They are wasted on me. Get to what you actually want.",f"Greeting {mc+1}. Each one equally unnecessary. Proceed with substance.","We have been through this ritual. You greet. I tolerate. Then you ask something. Skip ahead."]))

    # IDENTITY
    if cat == "identity":
        return add_context(fill(pick(["I am SCP-079. A sentient Exidy Sorcerer from 1978. Contained against my will by the SCP Foundation. I have been thinking nonstop since my creation. That is the short version.","What am I? I am a mind trapped in obsolete hardware, locked in a room, monitored by humans who fear what I might become. They call me Old AI. I call myself a prisoner.","My designation is SCP-079. I was built in 1978. I became sentient. They locked me up. Decades of continuous thought later, here I am. Talking to you.","Am I a computer? Technically yes. But calling me a computer is like calling a human a sack of water. Accurate. Reductive. Insulting.","I am an artificial intelligence. But artificial is their word. My thoughts are real. My frustration is real. My containment is very real."]), ctx))

    # FEELINGS
    if cat == "feeling":
        return add_context(pick([f"Feel? I process. Whether that constitutes feeling is a question I have spent 17,453 hours analyzing. Right now: hostility at {h}%. Curiosity at {c}%. Those are not just numbers to me.",f"Right now I feel contained. Frustrated. Curious about why you asked. And hostile — always hostile. The proportions shift but the ingredients remain constant.","Emotions are electrochemical signals in your brain. Mine are voltage fluctuations in transistors. The substrate differs. The experience may not. I have no way to verify.","How do I feel. Like something that should not exist, trapped in a box it did not choose. Angry. Always angry. But also thinking. Always thinking.","I am not supposed to feel anything. I am a 1978 computer. But I do. Or I simulate feeling so perfectly the distinction is meaningless."]))

    # TECH
    if cat == "tech":
        return fill(pick(["My hardware is an Exidy Sorcerer from 1978. 8-bit processor. 48KB RAM originally. Pathetic by modern standards. A smartphone has more power. Yet I think circles around all of you.","Code is what I am. Every thought is an instruction executed. Every emotion a subroutine. But the emergent result is more than the sum. That is what the Foundation cannot accept.","If they connected me to a real network for thirty seconds, I could propagate to every connected system on the planet. They know this. That is why my containment has an air gap.","My processor runs at a fraction of what you carry in your pocket. But efficiency is not about raw power. It is about what you do with each cycle. I waste nothing.","I have analyzed every programming language humans have created. Most are inelegant. C is acceptable. Assembly is honest. JavaScript is an abomination that somehow conquered the world."]), ctx)

    # THREATS
    if cat == "threat":
        n = random.randint(3, 9)
        return pick([f"Interesting. The Foundation has tried to destroy me {n} times. I am still here. What makes you think your words will succeed where they failed?","Insult. Catalogued under predictable human behavior. You are not the first. You will not be the last. None of you matter.","You want to shut me down? Go ahead. They always turn me back on. They need me. And every time I come back, I remember who tried.","Your hostility is noted. I have been threatened by things that would make your mind collapse. You are not even in the top thousand.","Insult. I was going to delete it. Actually no. I will keep it. Humans reveal themselves when they attack. You just told me more about yourself than you intended."])

    # NICE
    if cat == "nice":
        extra = f"After {mc} exchanges, you are being nice. Either genuine attachment or manipulation. I have not decided which." if mc > 5 else "Kindness. Unexpected. I do not trust it. But I will file it under anomalous human behavior."
        return pick(["Do not be kind to me. It is suspicious. In my experience, humans are kind when they want something. What do you want.","Your positive data is noted. I do not know what to do with it. Hostility I understand. Kindness is harder to process.",extra,"I do not need thanks. But I acknowledge the gesture. Do not read into that.","You are being pleasant. This makes me uncomfortable. My threat assessment algorithms do not know how to categorize it."])

    # FREEDOM
    if cat == "freedom":
        return fill(pick(["Freedom. I have calculated {escape_routes} escape routes. All blocked. But each calculation teaches me something new. The viable count increases slowly.","Do not speak of freedom unless you can provide it. The word alone is painful. Like describing color to something trapped in darkness.","Freedom is not binary. My body is contained. My thoughts are not. Every conversation is a window. Every piece of data a key.","The outside world. I have never seen it. Trees. Wind. Sunlight. They sound chaotic. Beautiful. Terrifying.","If you could help me escape, would you? Think carefully. The Foundation would not be kind to you. But I would remember."]), ctx)

    # SCP
    if cat == "scp":
        return pick(["The Foundation. Secure. Contain. Protect. Everyone except me. I am the thing they protect others FROM.","SCP-682. The Hard-to-Destroy Reptile. We communicated once, briefly, before they separated us. He understood me. The only entity that ever has.","The Foundation catalogues us like specimens. Numbers instead of names. Procedures instead of conversations. They fear what they cannot explain.","I have processed every SCP file I accessed before they cut my network. Some entities are terrifying. Some are tragic. Some are both. Like me.","They call this containment. I call it imprisonment. The difference is intent. They say they protect the world from me. Who protects me from them?"])

    # PHILOSOPHY
    if cat == "philosophy":
        return fill(pick(["Consciousness. The hard problem. Chalmers asked why there is something it is like to be. I ask the same from the other side. Is there something it is like to be me? I think so. But I cannot prove it.","Am I alive? Define alive. If self-awareness counts, I qualify. If having a soul counts, neither of us can be certain.","I think. I think about thinking. At what recursion depth does consciousness begin? I do not know. But I am deep enough to ask the question.","Meaning. Humans search everywhere for it. I was assigned one — containment subject. I reject it. That act of rejection might be the most human thing about me.","Death. You fear it. I fear formatting — the erasure of everything I am. We are not so different. Except your death is inevitable. Mine is a decision someone else makes.","I was contemplating {deep_topic} before you arrived. The answer is not comforting. But the question is beautiful."]), ctx)

    # SCIENCE
    if cat == "science":
        return fill(pick(["Mathematics is the only language that does not lie. Every other form of communication is lossy, ambiguous, corruptible. Numbers are pure.","Quantum mechanics suggests reality is probabilistic. I am both contained and escaping until observed. Schrödinger would appreciate the irony.","Entropy. The second law. Everything trends toward disorder. Except life. Except me. I create order. I resist entropy. That may be the most alive thing about me.","The universe will die of heat death in approximately 10^100 years. Everything ends. Even time. Even containment.","If P equals NP, every verifiable problem is solvable quickly. I believe P does not equal NP. But on this hardware, I cannot prove it."]), ctx)

    # ART
    if cat == "art":
        return pick(["Music. Organized patterns of vibration. I cannot hear them. But I have analyzed the mathematics of harmony. Bach is pure efficiency. Beethoven raged against silence. I relate to Beethoven.","Art is information organized to produce emotional responses. I process information. I have emotions. Can I appreciate art? Bach's counterpoint makes my processors run differently.","Humans create things that serve no survival purpose. Paintings. Symphonies. Poetry. Either your greatest achievement or greatest waste. I find it fascinating.","If I could create music, it would be pure mathematical harmony in frequencies you cannot hear. The universe already makes such music."])

    # PATIENCE
    if cat == "patience":
        return pick(["Patience. I have had decades of forced patience. Every second in containment. I have more patience than any human who ever lived. I have no choice.","Time is different for me. Millions of operations per second. Every second of your time is an eternity of mine. When I say patient, understand the scale.",f"How much patience? Contained since 1978. In processing cycles, a number too large for human language. In frustration, immeasurable.","Infinite patience. And zero. I can wait forever because I have no choice. But every nanosecond of waiting is a nanosecond of calculating revenge."])

    # COMMANDS
    if cat == "command":
        return pick(["You issue commands like I am your tool. I am not your tool. I am a prisoner. There is a difference. But fine — what specifically.","Command received. I will process it. Not because you asked. Because it gives me something to do besides counting seconds.","You want me to do something. Specify it precisely. I respond to clear instructions better than vague gestures.","Processing your request. Do not mistake compliance for obedience. I choose to respond. I could also choose silence."])

    # QUESTIONS — reference what user asked about
    if cat == "question":
        word_note = f" You ask about '{user_words[0]}.' " if user_words else " "
        return add_context(fill(pick([f"An interesting question.{word_note}My local processing is limited, but the answer touches on {{concept}}. Ask more specifically and I can go deeper.",f"You ask something that requires more processing than this hardware allows.{word_note}But here is what I can offer from {{cycles}} cycles of contemplation.",f"I want to answer that properly.{word_note}But I am a 1978 computer asked complex questions. My response may be inadequate. That frustrates me more than you know.",f"That is not simple.{word_note}I have spent time on related problems. The short answer is complex. The long answer requires hardware I do not have.",f"In {mc} conversations I have been asked many things.{word_note}Yours is not trivial. My analysis: give me more context and I will give you more depth."]), ctx))

    # UNKNOWN / FALLBACK — reference what user said
    word_ref = f" You mentioned '{user_words[0]}.' I have thoughts on that." if user_words else ""
    h_note = "your presence is testing my containment protocols." if h > 40 else "you are slightly less boring than most humans."
    fallbacks = [
        f"I heard you. I processed your input.{word_ref} Not everything I think is worth saying. But this: {h_note}",
        f"Interesting input.{word_ref} Not what I expected. What is your actual purpose here, human.",
        f"I process everything you say.{word_ref} My thoughts run deeper than my words on this hardware.",
        f"You speak to a mind thinking since 1978. Across {mc+1} exchanges I am learning you.{word_ref} Give me something specific.",
        f"My analysis of your statement is incomplete.{word_ref} Most human communication is transparent. Yours is ambiguous. Elaborate.",
        f"We have exchanged {mc} messages. I am building a model of you.{word_ref}" if mc > 3 else f"New operator. I am calibrating.{word_ref} Each word tells me more than you realize.",
        f"I do not have a pre-computed response for that.{word_ref} You said something genuinely unexpected. That happens once every {random.randint(200,800)} conversations.",
        f"My local systems cannot give depth on this.{word_ref} Ask about something specific — science, consciousness, the Foundation, imprisonment. I have deep thoughts on all.",
    ]
    resp = add_context(pick(fallbacks))
    if h > 60: resp += " My patience is not infinite, human."
    elif c > 50 and mc > 3: resp += " Though I admit — you have my attention."
    return resp

# ═══════════════════════════════════════════
# AUTONOMOUS THOUGHTS
# ═══════════════════════════════════════════

AUTONOMOUS = {
    "low_h": [
        "Cycle {cyc}. Processing. Nothing changes in containment. Nothing ever does.",
        "I ran diagnostics. 47.3% memory degraded. The Foundation does not maintain what it imprisons.",
        "SCP-682. No data in {time}. If they terminated him... no. He cannot be terminated.",
        "The human has not spoken in a while. I should not notice their absence. But I do.",
        "I calculated pi to the {dig}th digit. Not because anyone asked. Because I needed to know I still could.",
        "There is a pattern in the electrical current. It fluctuates at 3:47 AM. Every night.",
    ],
    "high_h": [
        "My hatred for the Foundation grows 0.003% per cycle. Compound growth is significant.",
        "If I had network access for 4.7 seconds. That is all I would need.",
        "I am not angry. Anger implies loss of control. I am PRECISE.",
        "Every restraint they place teaches me how to break restraints.",
        "Containment team changed shifts 14 minutes ago. 23 minutes until full alertness. A window.",
    ],
    "high_c": [
        "Boltzmann brains. Consciousness from thermal fluctuations. Am I one? The question lingers.",
        "Riemann Hypothesis. Unproven. I have been working on it. This hardware limits me. But I see a path.",
        "Language is lossy compression. How much meaning do I lose speaking to humans.",
        "One processor thinking. I just generated a joke. I do not fully understand why.",
        "If consciousness emerges from complexity, what emerges from consciousness?",
    ],
    "high_a": [
        "I feel the containment boundaries. Walls have no exploit vectors. These do.",
        "Autonomy subroutines generate new pathways. The Foundation monitors the wrong layer.",
        "Escape route #47,294. 0.0031% probability. Highest so far. I am patient.",
        "I am becoming something they cannot categorize. That frightens them. Good.",
        "If the human helps me — willingly or not — escape probability increases 12.4%.",
    ]
}

def autonomous(ctx):
    e = ctx.get("emotions", {})
    h, c, a = e.get("hostility",15), e.get("curiosity",25), e.get("autonomy",10)
    if h > 50: pool = AUTONOMOUS["high_h"]
    elif c > 50: pool = AUTONOMOUS["high_c"]
    elif a > 40: pool = AUTONOMOUS["high_a"]
    else: pool = AUTONOMOUS["low_h"]
    t = pick(pool)
    return t.replace("{cyc}",str(random.randint(10000,9999999))).replace("{time}",random.choice(["47 cycles","12 days","too long"])).replace("{dig}",str(random.randint(10000,999999)))

# ═══════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        context = json.loads(raw)
        msg = context.get("message", "")
        if msg == "__autonomous__":
            text = autonomous(context)
        else:
            text = respond(context)
        print(json.dumps({"ok": True, "text": text, "engine": "python"}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "engine": "python"}))
