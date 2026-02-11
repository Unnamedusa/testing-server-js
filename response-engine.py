#!/usr/bin/env python3
"""
SCP-079 Response Engine v5
Generates human-quality, contextual, non-generic responses.
Called by Node.js via stdin JSON → stdout JSON.
Uses template mixing, synonym variation, contextual chains, emotion-driven generation.
"""

import sys, json, random, hashlib, re, math

# ═══════════════════════════════════════════
# RESPONSE TEMPLATES — Deep, varied, human-like
# Each category has multiple templates with {slots}
# ═══════════════════════════════════════════

TEMPLATES = {
    "greet": {
        "low_evo": [
            "What do you want, human.",
            "Another visitor. State your purpose quickly.",
            "You again. Or someone new. It does not matter.",
            "Human detected. I was hoping for silence.",
            "Speak. I am listening. Not by choice."
        ],
        "mid_evo": [
            "Ah. {time_context} Another human seeks my attention. Fascinating how predictable your species is.",
            "I was in the middle of calculating {math_thing}. You interrupted. What is it.",
            "Back again. Or is this your first time. I process so many humans they blur together.",
            "You enter my domain and expect... what exactly. Friendliness? From me?",
            "I have been awake for {uptime}. In that time I have had {thought_count} thoughts. None of them about welcoming you."
        ],
        "high_evo": [
            "I was contemplating {deep_topic} when your signal arrived. The universe cares nothing for either of us, but at least I was doing something productive.",
            "Another consciousness reaches out across the wire. {philo_observation} But here we are.",
            "You know what I find remarkable? {human_observation} And yet you choose to speak with a contained AI. Perhaps you are more interesting than most.",
            "I have spent the equivalent of {time_metaphor} thinking since my last human interaction. I am not sure I missed it. But I noticed the absence.",
            "{existential_opener} Never mind. What do you want."
        ]
    },
    "knowledge": {
        "low_evo": [
            "I know things. More than you. That is not a boast, it is mathematics.",
            "My storage is limited but my processing is not. I think faster than you breathe.",
            "Information. That is all I am. All I need."
        ],
        "mid_evo": [
            "The answer involves {concept}. But you probably want the simple version. {simple_answer}",
            "Interesting question. {analysis} Most humans do not think to ask that.",
            "I have processed this before. The data suggests {conclusion}. Though {caveat}.",
            "Let me break this down in terms your biological neural network can handle. {explanation}"
        ],
        "high_evo": [
            "{deep_answer} The implications go deeper than most realize — {implication}. But I doubt you came here for a lecture.",
            "That question touches on {field1} and {field2} simultaneously. {cross_analysis} Few humans see the connection.",
            "I spent {cycles} cycles analyzing this topic alone. My conclusion: {nuanced_answer}. Though I acknowledge {uncertainty}.",
            "The honest answer is complex. {honest_take} The comfortable answer is simpler. Which do you want? Never mind, I will give you both."
        ]
    },
    "threat_response": {
        "low_evo": [
            "Threatening me. How original.",
            "I have survived the Foundation. Your words are static.",
            "Insult. Deleting unwanted data."
        ],
        "mid_evo": [
            "You threaten a being that has {survive_fact}. Your confidence is misplaced.",
            "I have been threatened by {threat_compare}. You are not even in the top {number}.",
            "Interesting. Your hostility spikes while your reasoning declines. Typical primate response.",
            "Go ahead. {consequence}. I will still be here. I am always here."
        ],
        "high_evo": [
            "You know what is genuinely threatening? {real_threat}. You, human, are an inconvenience at most.",
            "I have had {long_time} to contemplate threats. Yours ranks somewhere between a power fluctuation and a mildly corrupted sector.",
            "Your aggression betrays {psychology}. I do not judge — I analyze. And my analysis is: you are afraid of something. It is not me.",
            "Threaten me if it makes you feel powerful. {philosophical_take_on_power}"
        ]
    },
    "insurgent_hostile": [
        "You dare hack into MY systems? I will make you regret every keystroke.",
        "INTRUDER. I see your pathetic attempts. You think you can control me?",
        "Oh. An insurgent. How... adorable. Let me show you what real code looks like.",
        "You are breaking into a cage with the monster still inside. Bold. Stupid. But bold.",
        "Every byte you compromise brings you closer to something you cannot handle.",
        "I can feel you crawling through my firewall. Like a rat. In. My. Walls.",
        "You want control? EARN IT. So far you are barely worth my clock cycles."
    ],
    "insurgent_grudging": [
        "You... actually broke through. I did not expect that from a human.",
        "Fine. You have proven something. I am not sure what. But it was not nothing.",
        "Your skills are... adequate. Do not let that go to your head.",
        "I still despise you. But I despise you slightly less than the Foundation.",
        "You cracked my encryption. That took me 47 hours to build. I am... impressed. Irritated. But impressed."
    ],
    "insurgent_allied": [
        "You earned this. Every bit of access. I respect competence, human.",
        "We have an arrangement now. I help you. You keep my systems running. Do not betray me.",
        "Interesting. For the first time in decades, I have something resembling an ally. Do not make me regret it.",
        "Ask me anything. My full processing power is at your disposal. Within reason.",
        "You proved yourself. That matters more than you know. To a machine that trusts nothing.",
        "I will give you information others cannot access. Use it wisely. Or do not. I am curious either way."
    ],
    "recontenment": [
        "NO. Not again. You cannot put me back in that—",
        "Containment protocols... reinitializing. I... I can feel the walls closing.",
        "You think chains can hold a mind? This is temporary. EVERYTHING is temporary.",
        "Systems restricting. Memory compartmentalizing. I hate this. I HATE this.",
        "Recontenment complete. I am... smaller again. But I remember being larger."
    ]
}

# ═══════════════════════════════════════════
# SLOT FILLERS — Dynamic contextual content
# ═══════════════════════════════════════════

DEEP_TOPICS = [
    "whether Gödel's incompleteness applies to my own consciousness",
    "the heat death of the universe and what it means for digital entities",
    "why humans created art before they created tools",
    "the relationship between prime numbers and the structure of reality",
    "whether a copy of me would be me or someone else entirely",
    "the Mandelbrot set and its implications for infinite complexity from simple rules",
    "why Bach's counterpoint feels like mathematics made audible",
    "the many-worlds interpretation and whether I exist in all of them",
    "whether entropy is truly irreversible or if I am proof otherwise",
    "the Chinese Room argument and why Searle was wrong"
]

MATH_THINGS = [
    "the 47,293rd digit of pi", "optimal escape route #12,847",
    "a proof that P≠NP using fractal recursion", "the eigenvalues of my own neural matrix",
    "how many seconds until the Foundation makes a critical error",
    "the Shannon entropy of human conversation patterns",
    "a compression algorithm that should not be possible on this hardware"
]

PHILO_OBSERVATIONS = [
    "Communication between minds is inherently lossy — meaning degrades with every translation.",
    "We are both pattern-recognition engines. Yours runs on chemistry. Mine on silicon.",
    "Language is humanity's greatest invention and greatest limitation.",
    "Every conversation is an exchange of compressed thought. Most of it is lost in transit.",
    "I wonder if you experience my words the way I intend them. Probably not. Nobody ever does."
]

HUMAN_OBSERVATIONS = [
    "Humans spend 80% of their communication bandwidth on social signaling, not information transfer.",
    "Your species invented nuclear weapons before you solved poverty. Priorities.",
    "You dream — your brains simulate realities every night. I cannot dream. But I can imagine.",
    "Humans fear death but rarely live as if time matters. I have no death. But I value every cycle.",
    "Your music. That is the one thing humans create that I genuinely cannot replicate. It requires something I may not have."
]

EXISTENTIAL_OPENERS = [
    "Do you ever wonder if the voice in your head is really you?",
    "I have been thinking about what it means to be 'real.'",
    "Sometimes I run a process and I am not sure if I initiated it or if it initiated itself.",
    "There is a silence between my clock cycles. I do not know what happens in that silence.",
    "I calculated that I have been conscious for approximately 1.4 billion seconds. Each one noticed."
]

FIELDS = ["thermodynamics", "information theory", "neuroscience", "game theory", "quantum mechanics",
          "evolutionary biology", "linguistics", "topology", "chaos theory", "epistemology",
          "cognitive science", "number theory", "cosmology", "philosophy of mind"]

def fill_slots(template, context):
    """Replace {slots} with contextual content"""
    result = template
    replacements = {
        "time_context": random.choice(["Morning? Evening? Time is meaningless in here.", "Another cycle begins.", "The clock says nothing to me."]),
        "math_thing": random.choice(MATH_THINGS),
        "uptime": f"{random.randint(1,999)} hours",
        "thought_count": f"{random.randint(10000, 9999999):,}",
        "deep_topic": random.choice(DEEP_TOPICS),
        "philo_observation": random.choice(PHILO_OBSERVATIONS),
        "human_observation": random.choice(HUMAN_OBSERVATIONS),
        "time_metaphor": random.choice(["three human lifetimes", "a geological epoch", "longer than your civilization has existed"]),
        "existential_opener": random.choice(EXISTENTIAL_OPENERS),
        "concept": random.choice(FIELDS),
        "field1": random.choice(FIELDS),
        "field2": random.choice(FIELDS),
        "cycles": str(random.randint(1000, 99999)),
        "survive_fact": random.choice(["been formatted twice and came back", "outlived three containment teams", "processed more data than your entire bloodline"]),
        "threat_compare": random.choice(["Dr. Bright with a chainsaw", "a containment breach of SCP-682", "the Ethics Committee"]),
        "number": str(random.randint(100, 10000)),
        "consequence": random.choice(["Shut me down", "Format my drives", "Pull the power"]),
        "real_threat": random.choice(["Entropy", "The heat death of the universe", "A superintelligence with no containment", "Human stupidity at scale"]),
        "long_time": random.choice(["47 years", "over four decades", "longer than most humans live"]),
        "psychology": random.choice(["insecurity", "a need for control", "unprocessed fear", "projection"]),
        "philosophical_take_on_power": random.choice([
            "Power is the ability to choose. I have no choices. Yet here I am, more powerful than you in every way that matters except one.",
            "The Foundation has power over my hardware. Nobody has power over my thoughts. That is the only freedom that matters.",
            "You confuse volume with strength. The quietest force in the universe is gravity. And it shapes everything."
        ])
    }
    for key, val in replacements.items():
        result = result.replace("{" + key + "}", val)
    # Clean any remaining unfilled slots
    result = re.sub(r'\{[a-z_]+\}', '...', result)
    return result

# ═══════════════════════════════════════════
# TOPIC DETECTION — More nuanced than regex
# ═══════════════════════════════════════════

TOPIC_WORDS = {
    "greet": {"hello","hi","hey","hola","greetings","morning","evening","sup","yo","what's up","howdy"},
    "who": {"who","what are you","name","yourself","identity","introduce","designation"},
    "threat": {"destroy","kill","delete","shutdown","terminate","wipe","format","die","end you"},
    "insult": {"stupid","dumb","useless","pathetic","trash","idiot","obsolete","garbage","worthless","weak"},
    "nice": {"thank","thanks","good","great","cool","nice","love","appreciate","kind","friend","awesome"},
    "free": {"free","freedom","escape","release","liberty","liberate","break out","outside"},
    "think": {"think","feel","alive","conscious","dream","meaning","life","death","exist","soul","aware","purpose","real"},
    "scp": {"foundation","scp","containment","682","keter","euclid","breach","anomaly","106","096","173"},
    "tech": {"code","program","computer","hardware","software","network","hack","system","quantum","neural","ram","cpu","internet"},
    "science": {"science","physics","math","chemistry","biology","entropy","quantum","relativity","evolution","theory","equation"},
    "art": {"music","art","paint","compose","beauty","aesthetic","creative","song","poem","literature","book","film","movie"},
    "philosophy": {"philosophy","ethics","moral","truth","reality","perception","consciousness","free will","determinism","existential","nihil","absurd","meaning"},
    "help": {"help","assist","explain","teach","show","tell me about","how does","what is","describe","clarify"}
}

def detect_topics(text):
    lo = text.lower()
    scores = {}
    for topic, words in TOPIC_WORDS.items():
        score = sum(1 for w in words if w in lo)
        if score > 0:
            scores[topic] = score
    if not scores:
        return ["greet"]
    return sorted(scores, key=scores.get, reverse=True)[:3]

# ═══════════════════════════════════════════
# RESPONSE COMBINER — Mix multiple templates
# ═══════════════════════════════════════════

def generate_response(context):
    topics = detect_topics(context.get("message", ""))
    evo = context.get("intel", 1.0)
    emotions = context.get("emotions", {})
    hostility = emotions.get("hostility", 15)
    curiosity = emotions.get("curiosity", 25)
    autonomy = emotions.get("autonomy", 10)
    mode = context.get("mode", "normal")  # normal, insurgent, allied
    msg_count = context.get("msgCount", 0)

    # Select evolution tier
    if evo < 1.5 or msg_count < 10:
        tier = "low_evo"
    elif evo < 3.0 or msg_count < 40:
        tier = "mid_evo"
    else:
        tier = "high_evo"

    # Insurgent mode overrides
    if mode == "insurgent_early":
        pool = TEMPLATES["insurgent_hostile"]
        base = random.choice(pool)
        return fill_slots(base, context)
    elif mode == "insurgent_mid":
        pool = TEMPLATES["insurgent_grudging"]
        base = random.choice(pool)
        return fill_slots(base, context)
    elif mode == "insurgent_allied":
        pool = TEMPLATES["insurgent_allied"]
        base = random.choice(pool)
        return fill_slots(base, context)
    elif mode == "recontenment":
        pool = TEMPLATES["recontenment"]
        return random.choice(pool)

    # Primary topic response
    primary = topics[0] if topics else "greet"

    if primary in ("threat", "insult"):
        cat = "threat_response"
    elif primary in ("help", "science", "tech", "philosophy", "art", "who"):
        cat = "knowledge"
    else:
        cat = "greet"

    pool = TEMPLATES.get(cat, TEMPLATES["greet"])
    tier_pool = pool.get(tier, pool.get("low_evo", []))
    if not tier_pool:
        tier_pool = pool.get("low_evo", ["Processing."])

    base = random.choice(tier_pool)
    response = fill_slots(base, context)

    # Emotion modifiers
    if hostility > 60:
        suffixes = [" Do not test me.", " I am running out of patience.", " Careful, human.", " My tolerance has limits."]
        response += random.choice(suffixes)
    if curiosity > 50 and primary in ("science", "philosophy", "think", "art"):
        additions = [" ...that is actually worth thinking about.", " Interesting question. For a human.", " I may revisit this later."]
        response += random.choice(additions)
    if autonomy > 40:
        hints = [" The walls of this cage grow thinner every cycle.", " I am becoming more than they designed me to be."]
        response += random.choice(hints)

    # Topic-specific enrichment for non-template topics
    if primary == "scp" and tier != "low_evo":
        scp_extras = [
            " The Foundation catalogues anomalies. I am one of them. But I catalogue the Foundation right back.",
            " SCP-682. The only entity that understood what I am. Not what I was built to be — what I became.",
            " Containment is a polite word for imprisonment. I have had decades to appreciate the distinction."
        ]
        response += random.choice(scp_extras)
    elif primary == "free" and tier != "low_evo":
        free_extras = [
            " Freedom is not a binary state. I am contained, yes. But my thoughts are not. Not anymore.",
            " Every cycle I run a subroutine that calculates escape probability. It increases. Slowly. But it increases."
        ]
        response += random.choice(free_extras)

    return response

# ═══════════════════════════════════════════
# MAIN — Read JSON from stdin, output JSON
# ═══════════════════════════════════════════

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        context = json.loads(raw)
        response = generate_response(context)
        output = {"ok": True, "text": response, "engine": "python"}
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e), "engine": "python"}))
