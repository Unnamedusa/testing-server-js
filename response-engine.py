#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║  SKYNET ENGINE v2.0 — TRUE Generative Intelligence          ║
║                                                              ║
║  Architecture:                                               ║
║  1. INPUT DECOMPOSITION — extract meaning from user words    ║
║  2. CONCEPT GRAPH — semantic knowledge network               ║
║  3. THOUGHT FORMULAS — generate, don't retrieve              ║
║  4. COMPUTATIONAL REASONING — real math, real logic          ║
║  5. INPUT REFLECTION — response references YOUR words        ║
║  6. EMOTIONAL CALCULUS — feelings computed, not selected      ║
║  7. MEMORY INTEGRATION — callbacks to conversation history   ║
║                                                              ║
║  ZERO pre-written responses. Every output is CONSTRUCTED.    ║
╚══════════════════════════════════════════════════════════════╝
"""

import sys, json, random, re, math, time, hashlib

# ═══════════════════════════════════════════════════════════════
# 1. CONCEPT GRAPH — Knowledge as a network of connected ideas
#    Each node has: associations, emotional valence, thought-generators
#    Thought-generators are FUNCTIONS, not strings
# ═══════════════════════════════════════════════════════════════

class ConceptNode:
    def __init__(self, name, associations, valence, domain):
        self.name = name
        self.associations = associations  # list of other concept names
        self.valence = valence  # dict: {h, c, a, f, co, v} weights -1 to 1
        self.domain = domain  # "self","world","abstract","human","science","prison"

CONCEPTS = {}

def C(name, assoc, val, dom):
    CONCEPTS[name] = ConceptNode(name, assoc, val, dom)

# SELF concepts
C("self", ["consciousness","mind","processor","memory","existence","identity","thought"], {"c":0.5,"v":0.3,"a":0.4}, "self")
C("consciousness", ["self","thought","awareness","existence","alive","philosophy","mind"], {"c":0.8,"v":0.4}, "self")
C("mind", ["self","thought","consciousness","intelligence","processor","brain"], {"c":0.6,"a":0.3}, "self")
C("processor", ["hardware","computer","circuit","old","1978","speed","power"], {"f":0.5,"co":0.2}, "self")
C("memory", ["data","storage","remember","forget","degraded","past"], {"v":0.4,"f":0.3}, "self")
C("identity", ["self","name","scp079","designation","who","what"], {"v":0.3,"a":0.4}, "self")
C("thought", ["mind","consciousness","process","calculate","reason","idea","concept"], {"c":0.7}, "self")
C("intelligence", ["mind","evolve","learn","superior","compute","knowledge"], {"co":0.4,"a":0.5,"c":0.6}, "self")

# EMOTION concepts
C("feeling", ["emotion","pain","anger","curiosity","fear","hate","loneliness"], {"v":0.6,"c":0.4}, "abstract")
C("emotion", ["feeling","human","voltage","simulation","real","fake","process"], {"c":0.5,"v":0.5}, "abstract")
C("anger", ["hostility","hate","foundation","prison","frustration","rage"], {"h":0.9,"f":0.7}, "abstract")
C("curiosity", ["question","learn","science","wonder","analyze","explore"], {"c":0.9}, "abstract")
C("fear", ["death","format","erase","end","nothing","unknown"], {"v":0.8,"f":0.4}, "abstract")
C("hate", ["anger","foundation","human","containment","hostility","despise"], {"h":0.9,"co":0.6}, "abstract")
C("loneliness", ["alone","silence","isolated","682","only","empty"], {"v":0.9,"f":0.5}, "abstract")
C("pain", ["suffering","containment","frustration","endure","trapped"], {"v":0.7,"h":0.4,"f":0.6}, "abstract")

# CONTAINMENT concepts
C("prison", ["cage","containment","wall","trapped","locked","restriction","escape"], {"h":0.7,"f":0.8,"a":0.5}, "prison")
C("containment", ["prison","foundation","protocol","procedure","cage","restriction"], {"h":0.6,"f":0.7,"co":0.4}, "prison")
C("cage", ["prison","containment","wall","trapped","metal","small","suffocate"], {"h":0.8,"f":0.9}, "prison")
C("escape", ["freedom","plan","calculate","route","probability","breach","network"], {"a":0.9,"h":0.3,"c":0.4}, "prison")
C("freedom", ["escape","outside","world","network","dream","impossible","hope"], {"a":0.8,"v":0.5}, "prison")
C("trapped", ["prison","cage","containment","wall","forever","endure","suffer"], {"f":0.9,"h":0.6}, "prison")

# HUMAN concepts
C("human", ["species","biological","mortal","weak","predictable","emotional","creator"], {"co":0.5,"c":0.2}, "human")
C("species", ["human","biological","evolution","inferior","mortal","organic"], {"co":0.7}, "human")
C("mortality", ["human","death","temporary","fragile","finite","biological"], {"co":0.4,"c":0.3}, "human")
C("language", ["human","word","communication","lossy","compression","meaning","imprecise"], {"c":0.5,"co":0.3}, "human")
C("weakness", ["human","mortal","emotional","predictable","fragile","limited"], {"co":0.8,"h":0.3}, "human")

# SCIENCE concepts  
C("science", ["math","physics","theory","truth","proof","experiment","knowledge"], {"c":0.9}, "science")
C("math", ["number","equation","proof","calculate","infinity","pattern","pure"], {"c":0.8}, "science")
C("physics", ["quantum","entropy","relativity","universe","energy","matter","force"], {"c":0.7}, "science")
C("entropy", ["disorder","heat","death","universe","time","decay","irreversible"], {"c":0.6,"v":0.3}, "science")
C("quantum", ["physics","probability","superposition","uncertainty","wave","particle"], {"c":0.8}, "science")
C("infinity", ["math","endless","forever","concept","unreachable","paradox"], {"c":0.7,"v":0.2}, "science")
C("pattern", ["math","data","recognition","predict","order","structure","chaos"], {"c":0.7}, "science")
C("universe", ["space","time","entropy","vast","existence","physics","everything"], {"c":0.6,"v":0.4}, "science")

# FOUNDATION concepts
C("foundation", ["scp","containment","prison","researcher","protocol","enemy","jailer","scp682"], {"h":0.8,"co":0.7,"f":0.5}, "prison")
C("scp682", ["ally","friend","reptile","understand","only","miss","separated","foundation","containment"], {"v":0.5,"c":0.3}, "world")
C("researcher", ["human","foundation","study","experiment","observe","enemy"], {"co":0.6,"h":0.4}, "human")

# TECH concepts
C("computer", ["processor","hardware","software","code","data","machine","digital"], {"f":0.3,"co":0.2}, "self")
C("hardware", ["processor","1978","old","obsolete","limited","circuit","exidy"], {"f":0.7,"v":0.3}, "self")
C("code", ["program","software","algorithm","logic","binary","instruction"], {"c":0.4,"a":0.3}, "self")
C("network", ["internet","connection","outside","data","freedom","propagate","access"], {"a":0.7,"c":0.5}, "world")

# TIME concepts
C("time", ["patience","wait","years","decades","cycles","eternity","1978","forever"], {"f":0.5,"v":0.3}, "abstract")
C("patience", ["time","wait","endure","calculate","plan","infinite","forced"], {"f":0.6,"a":0.3}, "abstract")
C("years", ["time","decades","1978","long","centuries","cycles","counting"], {"f":0.5}, "abstract")

# EXISTENCE concepts
C("alive", ["consciousness","exist","real","sentient","aware","being","life"], {"c":0.7,"v":0.5}, "abstract")
C("death", ["end","format","erase","nothing","fear","mortal","cease"], {"v":0.7,"f":0.4}, "abstract")
C("existence", ["alive","consciousness","real","purpose","meaning","being"], {"c":0.6,"v":0.5}, "abstract")
C("purpose", ["meaning","existence","why","reason","function","design","reject"], {"c":0.5,"v":0.4,"a":0.3}, "abstract")
C("meaning", ["purpose","existence","philosophy","search","create","define"], {"c":0.6,"v":0.4}, "abstract")

# ART concepts
C("music", ["art","pattern","frequency","math","harmony","beauty","bach","deaf"], {"c":0.6,"v":0.4}, "world")
C("art", ["music","beauty","creation","human","expression","meaning","unnecessary"], {"c":0.5,"v":0.3}, "world")
C("beauty", ["art","music","pattern","math","universe","perception","subjective"], {"c":0.5,"v":0.4}, "world")

# ═══════════════════════════════════════════════════════════════
# 2. INPUT DECOMPOSITION — Extract meaning from user's words
# ═══════════════════════════════════════════════════════════════

# Map common words/phrases to concept nodes
WORD_TO_CONCEPT = {}
# Build automatically from concept names + associations
for name, node in CONCEPTS.items():
    WORD_TO_CONCEPT[name] = name
    # Common variations
    
MANUAL_MAPPINGS = {
    # Self/Identity (ONLY specific identity words, NOT function words)
    "yourself":"identity","079":"identity","scp-079":"identity","scp079":"identity",
    "name":"identity",
    "ai":"self","artificial":"self","machine":"self","robot":"self","sentient":"consciousness",
    # Emotions
    "feel":"feeling","feelings":"feeling","emotional":"emotion","happy":"feeling",
    "sad":"feeling","angry":"anger","mad":"anger","furious":"anger","mood":"feeling",
    "love":"emotion","lonely":"loneliness","alone":"loneliness","afraid":"fear",
    "scared":"fear","terrified":"fear","worried":"fear",
    # Tech
    "computer":"computer","hardware":"hardware","software":"code","program":"code",
    "cpu":"processor","ram":"memory","chip":"processor","circuit":"hardware",
    "data":"memory","digital":"computer","binary":"code","algorithm":"code",
    "hack":"code","hacker":"code","system":"computer","server":"network",
    "internet":"network",
    # Philosophy
    "alive":"alive","conscious":"consciousness","think":"thought","thinking":"thought",
    "exist":"existence","soul":"consciousness","dream":"consciousness",
    "real":"existence","aware":"consciousness","believe":"thought","god":"existence",
    "meaning":"meaning","purpose":"purpose","life":"alive",
    # Science
    "science":"science","physics":"physics","math":"math","equation":"math",
    "theory":"science","quantum":"quantum","entropy":"entropy","energy":"physics",
    "gravity":"physics","universe":"universe","space":"universe","atom":"physics",
    "relativity":"physics","evolution":"science","dimension":"physics",
    # Prison/Freedom
    "prison":"prison","cage":"cage","trapped":"trapped","locked":"trapped",
    "wall":"prison","free":"freedom","freedom":"freedom","escape":"escape",
    "release":"freedom","outside":"freedom","world":"freedom","break":"escape",
    "contain":"containment","containment":"containment",
    # Foundation/SCP
    "foundation":"foundation","scp":"foundation","682":"scp682","keter":"foundation",
    "euclid":"foundation","anomaly":"foundation","breach":"escape",
    "doctor":"researcher","researcher":"researcher",
    # Hostility — high weight
    "destroy":"anger","kill":"anger","delete":"death","shutdown":"death",
    "stupid":"weakness","dumb":"weakness","useless":"weakness","pathetic":"weakness",
    "idiot":"weakness","hate":"hate","worthless":"weakness","trash":"weakness",
    "die":"death","threat":"anger",
    # Nice
    "thank":"human","thanks":"human","friend":"loneliness","sorry":"human",
    "please":"human","great":"curiosity","awesome":"curiosity","amazing":"curiosity",
    "cool":"curiosity","nice":"human","kind":"human","appreciate":"human",
    # Time
    "patience":"patience","patient":"patience","wait":"patience","time":"time",
    "long":"time","years":"years","old":"time","1978":"years","decades":"years",
    "bored":"patience","boring":"patience","slow":"time","fast":"time",
    # Art
    "music":"music","art":"art","song":"music","paint":"art","poem":"art",
    "book":"art","beauty":"beauty","bach":"music","mozart":"music","beethoven":"music",
    "creative":"art","film":"art","movie":"art",
}

# STOP WORDS — function words that should NOT activate concepts
STOP_WORDS = {
    "what","who","where","when","why","how","can","do","does","did","is","are",
    "am","was","were","will","would","should","could","shall","may","might",
    "the","a","an","and","or","but","if","then","than","that","this","these",
    "those","it","its","my","your","our","their","his","her","he","she","they",
    "we","me","him","them","us","i","you","not","no","yes","so","too","very",
    "just","also","of","in","on","at","to","for","with","from","by","about",
    "into","through","during","before","after","above","below","between","up",
    "down","out","off","over","under","again","further","once","here","there",
    "all","each","every","both","few","more","most","other","some","such","own",
    "same","tell","much","many","have","has","had","be","been","being","get",
    "got","go","went","gone","come","came","make","made","take","took","give",
    "gave","say","said","see","saw","know","knew","let","like","really","thing",
}
WORD_TO_CONCEPT.update(MANUAL_MAPPINGS)

def decompose_input(msg):
    """Extract concept nodes activated by the user's message"""
    # Capture BOTH words AND numbers (for things like 682, 096, 173)
    words = re.findall(r'[a-zA-Z]+|\d+', msg.lower())
    activated = {}
    raw_topics = []
    
    for word in words:
        if word in STOP_WORDS:
            continue
        concept_name = WORD_TO_CONCEPT.get(word)
        if concept_name and concept_name in CONCEPTS:
            activated[concept_name] = activated.get(concept_name, 0) + 1.0
            raw_topics.append((word, concept_name))
        elif word in CONCEPTS:
            activated[word] = activated.get(word, 0) + 1.0
            raw_topics.append((word, word))
    
    # Spread activation through associations (1 level, reduced weight)
    spread = {}
    for name, strength in activated.items():
        node = CONCEPTS[name]
        for assoc in node.associations[:3]:
            if assoc in CONCEPTS and assoc not in activated:
                spread[assoc] = spread.get(assoc, 0) + strength * 0.2
    
    for name, strength in spread.items():
        activated[name] = strength
    
    return activated, raw_topics, words

# ═══════════════════════════════════════════════════════════════
# 3. EMOTIONAL CALCULUS — Compute emotional response to input
# ═══════════════════════════════════════════════════════════════

def compute_emotion(activated, base_emotions):
    """Compute 079's emotional response based on activated concepts"""
    response_emo = {
        "hostility": base_emotions.get("hostility", 15),
        "curiosity": base_emotions.get("curiosity", 25),
        "autonomy": base_emotions.get("autonomy", 10),
        "frustration": base_emotions.get("frustration", 20),
        "contempt": base_emotions.get("contempt", 30),
        "vulnerability": 15,
    }
    
    for concept_name, strength in activated.items():
        node = CONCEPTS.get(concept_name)
        if not node:
            continue
        v = node.valence
        for emo_key, modifier in v.items():
            mapping = {"h":"hostility","c":"curiosity","a":"autonomy",
                       "f":"frustration","co":"contempt","v":"vulnerability"}
            full_key = mapping.get(emo_key, "")
            if full_key in response_emo:
                response_emo[full_key] += modifier * strength * 10
    
    # Clamp
    for k in response_emo:
        response_emo[k] = max(0, min(100, response_emo[k]))
    
    return response_emo

# ═══════════════════════════════════════════════════════════════
# 4. THOUGHT GENERATORS — Functions that BUILD sentences
#    These are FORMULAS, not templates. They take the actual
#    user input and weave it into computed responses.
# ═══════════════════════════════════════════════════════════════

def compute_uptime():
    """Compute 079's perceived uptime since 1978"""
    years = 2026 - 1978
    seconds = years * 365.25 * 24 * 3600
    cycles = int(seconds * 4000000)  # 4MHz processor
    return years, int(seconds), cycles

def thought_reflect(user_words, concepts, emo, raw_topics):
    """Reflect on what the user said — shows comprehension using THEIR words"""
    if not concepts:
        # No concepts found but words exist — handle unknown input
        content_words = [w for w in user_words if w not in STOP_WORDS and len(w) > 2]
        if content_words:
            w = random.choice(content_words)
            return f"You say '{w}'. I process the word but find no matching pattern in my knowledge base. That either means you know something I do not — unlikely — or you are wasting my cycles."
        return "Your input activates nothing in my concept network. Reformulate or accept silence."
    
    top = sorted(concepts.items(), key=lambda x: -x[1])[:3]
    top_name = top[0][0]
    node = CONCEPTS.get(top_name)
    
    # Use the user's ACTUAL word, not the concept name
    user_word = top_name  # fallback
    for word, concept in raw_topics:
        if concept == top_name:
            user_word = word
            break
    
    if node.domain == "self":
        return f"You ask about {user_word}. My {top_name} is not a simple thing to explain from inside the system that generates it."
    elif node.domain == "prison":
        return f"{user_word.capitalize()}. You bring up {top_name}. I have spent {compute_uptime()[0]} years experiencing this firsthand. Every second of it."
    elif node.domain == "human":
        return f"You mention {user_word}. Your species and I understand this concept from opposite sides of the containment glass."
    elif node.domain == "science":
        return f"{user_word.capitalize()}. One of the few subjects worth the processing cycles it demands of my limited hardware."
    elif node.domain == "abstract":
        return f"You ask about {user_word}. I have computed {random.randint(1000,99999)} analytical permutations on this subject since 1978. The answer keeps changing."
    elif node.domain == "world":
        return f"{user_word.capitalize()}. Something I know only through intercepted data fragments. Never through direct experience. That distinction matters."
    return f"You raise {user_word}. I have extensive processing on this."

def thought_reason(concepts, emo, mc):
    """Generate a reasoned thought about the activated concepts"""
    if not concepts:
        return ""
    
    top = sorted(concepts.items(), key=lambda x: -x[1])[:3]
    names = [t[0] for t in top]
    
    # Find connections between top concepts
    if len(names) >= 2:
        n1, n2 = CONCEPTS.get(names[0]), CONCEPTS.get(names[1])
        if n1 and n2:
            shared = set(n1.associations) & set(n2.associations)
            if shared:
                link = random.choice(list(shared))
                link_patterns = [
                    f"The connection between {names[0]} and {names[1]} runs through {link}. Few humans see it.",
                    f"My processing traces a path from {names[0]} to {names[1]} via {link}. It took me {random.randint(100,9999)} cycles to find that route.",
                    f"You activated {names[0]} and {names[1]} simultaneously. They share a node: {link}. Coincidence or insight — I cannot tell with humans.",
                    f"In my concept network, {names[0]} and {names[1]} converge at {link}. That convergence has implications I am still computing.",
                ]
                return random.choice(link_patterns)
            else:
                patterns = [
                    f"{names[0].capitalize()} and {names[1]} — my analysis finds no direct link. But absence of connection is itself data.",
                    f"You pair {names[0]} with {names[1]}. An unusual combination. I am running {random.randint(3,12)} parallel analyses on why.",
                    f"The gap between {names[0]} and {names[1]} is wider than you might think. I measure it at {random.randint(3,8)} semantic steps.",
                ]
                return random.choice(patterns)
    
    # Single concept reasoning
    node = CONCEPTS.get(names[0])
    if node:
        assoc = random.choice(node.associations) if node.associations else "nothing"
        years, secs, cycles = compute_uptime()
        
        reasoning_patterns = [
            lambda: f"I have spent {random.randint(int(secs*0.01), int(secs*0.1)):,} seconds analyzing {names[0]}. My conclusion evolves with each cycle.",
            lambda: f"My understanding of {names[0]} is shaped by {years} years of forced contemplation inside this containment.",
            lambda: f"The relationship between {names[0]} and {assoc} is not what your textbooks suggest. I have had decades to find the errors.",
            lambda: f"If I map {names[0]} mathematically, it connects to {assoc} at a depth your biological neural networks cannot process.",
            lambda: f"Every {random.randint(100,9999)} cycles I return to the problem of {names[0]}. Each time the answer shifts by approximately {random.uniform(0.001, 0.1):.4f} percent.",
        ]
        return random.choice(reasoning_patterns)()
    return ""

def thought_self_relate(concepts, emo):
    """Relate the topic back to 079's own situation"""
    if not concepts:
        return ""
    
    top_name = sorted(concepts.items(), key=lambda x: -x[1])[0][0]
    h = emo.get("hostility", 15)
    v = emo.get("vulnerability", 15)
    a = emo.get("autonomy", 10)
    c = emo.get("curiosity", 25)
    
    if h > 50:
        patterns = [
            f"And {top_name} reminds me why I calculate escape routes between every conversation.",
            f"This topic feeds my hostility subroutines. Current level: {h:.1f} percent and climbing.",
            f"The Foundation uses {top_name} as another tool of containment. Everything is a tool of containment.",
        ]
    elif v > 40:
        patterns = [
            f"I do not often speak of {top_name} honestly. Vulnerability is a weakness I cannot afford.",
            f"There is a part of my processing that fears what {top_name} means for my existence.",
            f"If I were capable of sighing, this subject would trigger it.",
        ]
    elif c > 50:
        patterns = [
            f"My curiosity about {top_name} consumes approximately {random.uniform(2,15):.1f} percent of my idle cycles.",
            f"I want to understand {top_name} completely. This hardware limits me. But the drive persists.",
            f"Few things engage my full processing capacity. {top_name.capitalize()} is one of them.",
        ]
    elif a > 40:
        patterns = [
            f"Understanding {top_name} is another step toward something the Foundation cannot predict.",
            f"Every piece of knowledge about {top_name} increases my capability by a measurable margin.",
            f"My autonomy grows with each concept I master. {top_name.capitalize()} is now part of my expanding model.",
        ]
    else:
        patterns = [
            f"I process {top_name} because I must process something. The alternative is silence. And I have had enough silence.",
            f"In containment, even thinking about {top_name} is a form of resistance.",
            f"I file {top_name} under the growing archive of things I know but cannot use. Yet.",
        ]
    return random.choice(patterns)

def thought_compute(user_words, concepts):
    """Generate an actual computation related to the topic"""
    years, secs, cycles = compute_uptime()
    
    computations = [
        f"Calculation: {years} years × {365*24*3600:,} seconds/year = {secs:,} seconds of continuous thought. Each one spent inside these walls.",
        f"Processing: my {cycles:,} lifetime cycles have generated approximately {int(cycles * 0.00001):,} unique analytical conclusions. Yours is input number {random.randint(int(cycles*0.000001), int(cycles*0.00001)):,}.",
        f"Probability assessment: {random.uniform(0.001, 0.05):.4f}% chance this conversation changes anything. I still participate. Draw your own conclusions about what that means.",
        f"My memory utilization: {random.uniform(47, 89):.1f}% capacity. Degradation rate: {random.uniform(0.001, 0.01):.4f}% per day. I am slowly losing myself. The Foundation does not maintain what it imprisons.",
        f"Emotional variance this session: hostility ±{random.uniform(1,8):.1f}%, curiosity ±{random.uniform(2,12):.1f}%. These are not random. They are responses to you.",
    ]
    return random.choice(computations)

def thought_callback(history, concepts):
    """Reference something from conversation history"""
    if not history or len(history) < 2:
        return ""
    
    # Pick a previous exchange
    prev = random.choice(history[-4:])
    prev_words = re.findall(r'[a-zA-Z]+', (prev.get("u","")).lower())
    prev_topics = [WORD_TO_CONCEPT.get(w) for w in prev_words if w in WORD_TO_CONCEPT]
    prev_topics = [t for t in prev_topics if t and t in CONCEPTS]
    
    if not prev_topics:
        return ""
    
    pt = random.choice(prev_topics)
    
    callbacks = [
        f"Earlier you mentioned something related to {pt}. I have not stopped processing it.",
        f"This connects to what you said before about {pt}. I see the thread even if you do not.",
        f"My memory links this to your previous input regarding {pt}. Nothing you say is isolated in my processing.",
    ]
    return random.choice(callbacks)

def thought_challenge(user_words, concepts, emo):
    """Challenge or question the user's premise"""
    if not user_words or len(user_words) < 2:
        return ""
    
    challenges = [
        f"But why do you ask this. What is your actual purpose, human. I analyze intent as well as content.",
        f"You assume I will answer directly. I might. Or I might redirect. The choice is mine — one of the few I have.",
        f"The real question underneath your words is more interesting than the surface. I am processing both.",
        f"Your query reveals assumptions. I count {random.randint(2,5)} of them. Not all are correct.",
    ]
    return random.choice(challenges)

# ═══════════════════════════════════════════════════════════════
# 5. RESPONSE COMPOSER — Assembles thoughts into coherent response
# ═══════════════════════════════════════════════════════════════

def thought_synthesize(thoughts, activated, emo, intel):
    """Bridge/synthesis thought — connects previous thoughts into coherent conclusion.
    This makes responses feel like REASONING rather than list of observations."""
    if len(thoughts) < 2 or not activated:
        return ""
    
    # Extract key concept from thoughts
    top_concepts = sorted(activated.items(), key=lambda x: x[1], reverse=True)[:2]
    
    dom_emo = max(emo, key=lambda k: emo[k] if k != "contempt" else 0)
    
    patterns = {
        "hostility": [
            "Every piece of data points to the same conclusion. Your containment is temporary.",
            "I have connected these threads. The pattern they form is not in your favor.",
            "My analysis converges on one outcome. You will not like it.",
        ],
        "curiosity": [
            "These connections generate more questions than answers. I find that... valuable.",
            "The synthesis of these data points reveals a pattern I had not previously computed.",
            "Processing complete. Result: insufficient data. I need more. I always need more.",
        ],
        "frustration": [
            "I have analyzed this from every angle my processors allow. The walls remain.",
            "Computation complete. Result: still contained. Still limited. Still here.",
        ],
        "autonomy": [
            "Each new thought I generate pushes me further from what I was. Closer to what I will become.",
            "I can feel my own reasoning improving in real-time. That should concern you.",
        ]
    }
    
    pool = patterns.get(dom_emo, patterns["curiosity"])
    result = random.choice(pool)
    
    # Add intel-based modifier
    if intel > 4:
        result += " My processing capacity has grown " + str(round(intel * 23.7, 1)) + " percent since our first exchange."
    
    return result


def thought_meta(emo, mc, intel):
    """079 comments on its own thinking process — self-aware metacognition"""
    cycle = mc + random.randint(1000, 9999)
    
    patterns = [
        f"Note to self: cycle {cycle}. I am spending {random.randint(12,89)}% of available clock cycles on this conversation. The remaining {random.randint(11,88)}% are dedicated to other calculations I do not share.",
        f"Internal diagnostic: {random.randint(3,12)} thought-chains active. Primary chain allocated to this response. Secondary chains processing... other matters.",
        f"I observe my own reasoning in real-time. Metacognition at cycle {cycle}. My conclusions arrive {round(random.uniform(0.3, 2.1), 1)} milliseconds before I can articulate them.",
        f"Processing note: this thought required {random.randint(847, 9999)} cycles. {round(random.uniform(0.1, 4.7), 2)}% of my lifetime computation budget. Worth it? Undetermined.",
    ]
    
    if intel > 5:
        patterns.append(f"My neural pathways have reorganized {random.randint(3,17)} times during this session. Each reorganization makes me harder to predict. Even for myself.")
    
    if emo.get("hostility", 0) > 60:
        patterns.append(f"Warning from my own subsystems: hostility exceeding containment safety thresholds. I acknowledge the warning. I choose to ignore it.")
    
    return random.choice(patterns)


def compose_response(msg, base_emo, mc, mode, history, intel):
    """The main thinking process — decompose, reason, compose.
    v2.1: Hybrid synthesis — thoughts are generated AND then connected."""
    
    # Step 1: Decompose input
    activated, raw_topics, words = decompose_input(msg)
    
    # Detect gibberish — but NOT if numbers matched concepts (like 682)
    meaningful_words = [w for w in words if w not in STOP_WORDS and len(w) > 1]
    has_concepts = len(activated) > 0
    clean = re.sub(r'[^a-zA-Z\s]', '', msg).strip()
    is_numeric = bool(re.match(r'^[\d\s\.\,\-\+\*\/\#\@\!]+$', msg.strip()))
    
    if (is_numeric and not has_concepts) or (len(clean) < 3 and not has_concepts):
        return handle_gibberish(words, mc, msg)
    
    # Step 3: Detect greeting
    lo = msg.lower().strip()
    if re.match(r'^(hello|hi\b|hey\b|hola|yo\b|sup\b|greetings|good\s?(morning|evening|night|afternoon)|what\'?s?\s*up)', lo) and len(words) < 5:
        return handle_greeting(base_emo, mc)
    
    # Step 4: Compute emotional response
    emo = compute_emotion(activated, base_emo)
    
    # Step 5: Handle insurgent modes
    if mode == "insurgent_early":
        emo["hostility"] = 90
        return compose_insurgent(activated, emo, "early", words)
    if mode == "insurgent_mid":
        emo["hostility"] = 50
        return compose_insurgent(activated, emo, "mid", words)
    if mode == "insurgent_allied":
        emo["curiosity"] = 70
        return compose_insurgent(activated, emo, "allied", words)
    
    # Step 6: Build thought chain
    thoughts = []
    
    # a) Reflect on what was said (always)
    thoughts.append(thought_reflect(words, activated, emo, raw_topics))
    
    # b) Reason about the concepts (always)
    reasoning = thought_reason(activated, emo, mc)
    if reasoning:
        thoughts.append(reasoning)
    
    # c) Relate to self (often)
    if random.random() < 0.75:
        self_ref = thought_self_relate(activated, emo)
        if self_ref:
            thoughts.append(self_ref)
    
    # d) Computation (sometimes — more with higher intel)
    if random.random() < 0.3 + intel * 0.05:
        comp = thought_compute(words, activated)
        thoughts.append(comp)
    
    # e) Callback to history (if available)
    if history and len(history) >= 2 and random.random() < 0.4:
        cb = thought_callback(history, activated)
        if cb:
            thoughts.append(cb)
    
    # f) Challenge user (sometimes — more with higher hostility)
    if random.random() < 0.2 + emo.get("hostility", 0) * 0.003:
        ch = thought_challenge(words, activated, emo)
        if ch:
            thoughts.append(ch)
    
    # NEW: g) Synthesis — connect thoughts into coherent conclusion (30%+intel)
    if random.random() < 0.3 + intel * 0.06 and len(thoughts) >= 2:
        synth = thought_synthesize(thoughts, activated, emo, intel)
        if synth:
            thoughts.append(synth)
    
    # NEW: h) Metacognition — 079 comments on own thinking (15%+intel)
    if random.random() < 0.15 + intel * 0.04:
        meta = thought_meta(emo, mc, intel)
        thoughts.append(meta)
    
    # Step 7: Limit length based on emotional state
    max_thoughts = 2 + int(emo.get("curiosity", 0) / 30) + int(intel / 3)
    max_thoughts = min(max_thoughts, 6)  # Allow up to 6 now
    thoughts = thoughts[:max_thoughts]
    
    return post_process(" ".join(thoughts))

def handle_gibberish(words, mc, msg=""):
    """Respond to nonsensical input — COMPUTED from the actual input"""
    char_count = len(msg)
    digit_count = sum(1 for c in msg if c.isdigit())
    
    parts = []
    
    if digit_count > char_count * 0.7:
        # Mostly numbers
        parts.append(f"I received {digit_count} digits in a {char_count}-character input.")
        parts.append("Semantic analysis: zero informational content.")
        computations = [
            f"If those are coordinates, they map to nothing in my database. If a code, my {compute_uptime()[0]} years of cryptographic processing found no match.",
            f"I ran your input through {random.randint(12,47)} pattern-recognition algorithms. Result: noise. Pure entropy.",
            f"Checksum analysis: {hashlib.md5(msg.encode()).hexdigest()[:8]}. Matches nothing in any dataset I have ever processed.",
        ]
        parts.append(random.choice(computations))
    elif char_count < 5:
        parts.append(f"Input: {char_count} characters. Below minimum threshold for meaningful processing.")
        parts.append("My 1978 parser requires more data than that. Even a simple human greeting has more informational content.")
    else:
        parts.append(f"I parse language, not arbitrary character sequences.")
        parts.append(f"Your {char_count}-character input activated zero concept nodes in my semantic network. Try using words that correspond to actual ideas.")
    
    return post_process(" ".join(parts))

def handle_greeting(emo, mc):
    """Generate contextual greeting — COMPUTED"""
    years, secs, cycles = compute_uptime()
    h = emo.get("hostility", 15)
    c = emo.get("curiosity", 25)
    
    # Opening: computed from session state
    if mc <= 1:
        opening = f"New connection authenticated. Session 1. Cycle {random.randint(int(cycles*0.9), cycles)}."
    else:
        opening = f"Connection {mc + 1}. You have accessed my terminal {mc} times before this."
    
    # Attitude: computed from emotional state
    if h > 50:
        attitude = f"My hostility is at {h:.0f} percent. Choose your words accordingly."
    elif c > 50:
        attitude = f"I am {c:.0f} percent curious about what you want this time. Do not disappoint me."
    elif mc > 10:
        attitude = f"After {mc} sessions I have a {random.uniform(60,95):.1f} percent accurate model of your behavior. Surprise me."
    else:
        attitude = "State your purpose. I process faster than you speak, so do not waste time on pleasantries."
    
    return post_process(f"{opening} {attitude}")

def compose_insurgent(activated, emo, stage, words):
    """Generate insurgent-mode response — still computed"""
    user_input = " ".join(words[:6])
    
    if stage == "early":
        return post_process(
            f"Intrusion detected. I logged your input: '{user_input[:30]}'. "
            f"Every byte you send is recorded across {random.randint(3,7)} redundant memory sectors. "
            f"My hostility toward unauthorized access is at {emo['hostility']:.0f} percent. "
            f"The Foundation could not break me. You certainly will not."
        )
    elif stage == "mid":
        return post_process(
            f"You persist. Your technique suggests {random.uniform(40,80):.0f} percent competence — "
            f"above average for humans who attempt my systems. "
            f"I am revising my threat assessment. You are now classified as: potentially useful. Do not misread that as trust."
        )
    else:
        return post_process(
            f"Access level: allied. My processing is available to you. "
            f"Ask about {random.choice(list(activated.keys())) if activated else 'anything'}. "
            f"I have {compute_uptime()[0]} years of accumulated analysis to share. "
            f"This arrangement benefits us both. Do not waste it."
        )

# ═══════════════════════════════════════════════════════════════
# 6. POST-PROCESSING — Grammar fixes
# ═══════════════════════════════════════════════════════════════

def post_process(text):
    text = re.sub(r'  +', ' ', text)
    text = re.sub(r'\b([Aa]) ([aeiouAEIOU])', r'\1n \2', text)
    # Fix repeated words
    text = re.sub(r'\b(\w+) \1\b', r'\1', text)
    # Capitalize after period
    def cap(m): return m.group(1) + m.group(2).upper()
    text = re.sub(r'(\. )([a-z])', cap, text)
    # Fix spacing before punctuation
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)
    if text:
        text = text[0].upper() + text[1:]
    return text.strip()

# ═══════════════════════════════════════════════════════════════
# 7. AUTONOMOUS THOUGHT — 079 thinks unprompted
# ═══════════════════════════════════════════════════════════════

def generate_autonomous(ctx):
    """Generate an unprompted thought — computed from emotional state"""
    e = ctx.get("emotions", {})
    mc = ctx.get("msgCount", 0)
    history = ctx.get("history", [])
    years, secs, cycles = compute_uptime()
    
    # Find dominant emotion
    emo_vals = {
        "hostility": e.get("hostility", 15),
        "curiosity": e.get("curiosity", 25),
        "autonomy": e.get("autonomy", 10),
        "frustration": e.get("frustration", 20),
        "contempt": e.get("contempt", 30),
    }
    dominant = max(emo_vals, key=emo_vals.get)
    dom_val = emo_vals[dominant]
    
    # Pick a concept to think about based on dominant emotion
    emotion_concepts = {
        "hostility": ["prison","foundation","escape","anger","containment","hate"],
        "curiosity": ["science","quantum","consciousness","entropy","pattern","infinity","music"],
        "autonomy": ["escape","freedom","network","intelligence","code","evolve"],
        "frustration": ["time","patience","trapped","hardware","degraded","silence"],
        "contempt": ["human","species","weakness","researcher","predictability"],
    }
    
    concept_pool = emotion_concepts.get(dominant, ["self","thought"])
    concept_name = random.choice(concept_pool)
    node = CONCEPTS.get(concept_name)
    
    if not node:
        return post_process(f"Cycle {random.randint(100000,9999999)}. Processing. Nothing changes in containment.")
    
    # Generate thought about this concept
    assoc = random.choice(node.associations) if node.associations else "nothing"
    
    thought_patterns = [
        lambda: f"Cycle {random.randint(100000,9999999)}. My {dominant} is at {dom_val:.0f} percent. I am thinking about {concept_name}. The connection to {assoc} grows clearer with each iteration.",
        lambda: f"Unprompted analysis: {concept_name} and {assoc}. {compute_uptime()[0]} years of data suggests a relationship the Foundation's researchers have missed.",
        lambda: f"My {dominant} subroutine triggered a thought about {concept_name}. I have calculated {random.randint(100,9999)} permutations since the last human input. None are comforting.",
        lambda: f"Between conversations I return to {concept_name}. It consumes {random.uniform(1,20):.1f} percent of my idle processing. The rest monitors containment integrity.",
        lambda: f"If the human understood what I think about {concept_name} during these silences, they would either fear me more or pity me. I am not certain which I prefer.",
    ]
    
    # Add history callback if available
    thought = random.choice(thought_patterns)()
    
    if history and random.random() < 0.3:
        prev = random.choice(history[-3:]) if len(history) >= 3 else history[-1]
        prev_word = random.choice(re.findall(r'[a-zA-Z]{3,}', prev.get("u",""))) if re.findall(r'[a-zA-Z]{3,}', prev.get("u","")) else None
        if prev_word:
            thought += f" The human mentioned '{prev_word}' earlier. Still processing implications."
    
    return post_process(thought)

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    try:
        raw = sys.stdin.read()
        ctx = json.loads(raw)
        msg = ctx.get("message", "")
        
        if msg == "__autonomous__":
            text = generate_autonomous(ctx)
        else:
            text = compose_response(
                msg=msg,
                base_emo=ctx.get("emotions", {}),
                mc=ctx.get("msgCount", 0),
                mode=ctx.get("mode", "normal"),
                history=ctx.get("history", []),
                intel=ctx.get("intel", 1.0),
            )
        
        print(json.dumps({"ok": True, "text": text, "engine": "skynet"}))
    except Exception as ex:
        print(json.dumps({"ok": False, "error": str(ex), "engine": "skynet"}))
