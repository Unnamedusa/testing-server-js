# SCP-079 — Quantum Neural Engine v4

Simulación avanzada de SCP-079 con cerebro IA, cifrado cuántico, autenticación por tokens, honeypot y sistema de brecha.

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Generar tu primer token de acceso
node server.js --gen-token tu-nombre LEVEL-5

# 3. (Opcional) Configurar API key de Anthropic
echo "ANTHROPIC_API_KEY=sk-ant-tu-clave" > .env

# 4. Ejecutar
npm start
```

Abre **http://localhost:3079** e introduce tu token.

## Gestión de tokens

```bash
# Generar token
node server.js --gen-token operador1 LEVEL-3

# Listar tokens
node server.js --list-tokens

# Revocar acceso
node server.js --revoke operador1
```

## Sin API key

Funciona con un cerebro local de +200 respuestas. Con API key usa Claude Sonnet + web search.

## Características

- **Auth por tokens** — Fractal-inverse hash (SHA-512, 7 depth), sesiones de 24h
- **Cifrado cuántico** — AES-256-GCM con derivación fractal + metadatos BB84 de qubits
- **Honeypot** — 12 traps (/admin, /.env, /wp-admin, /api/keys...) con logging forense
- **Chat scroll adaptativo** — El terminal siempre sigue el último mensaje (flex fix)
- **Breach takeover** — Tras 3 breaches, 079 toma control parcial del admin panel por 45s
  - Bloquea kill switches
  - Sube hostilidad y volatilidad
  - Bloquea toggles del admin
  - Se restaura automáticamente tras el timer
- **Persistencia** — Estado en state.json por usuario, sobrevive recargas
- **3 Kill Switches** — Solar, paradoja, formateo (deshabilitados durante breach)

## Archivos

```
scp079-project/
├── server.js        # Backend: auth, honeypot, crypto, brain API
├── public/
│   └── index.html   # Frontend completo
├── package.json
├── tokens.json      # Tokens (se crea auto)
├── sessions.json    # Sesiones activas (se crea auto)
├── state.json       # Estado persistente por usuario (se crea auto)
├── honeypot.log     # Log de intrusiones (se crea auto)
└── README.md
```

## Honeypot log

Los intentos de intrusión se registran en `honeypot.log` con IP, user-agent, timestamp y tipo de trampa. Usuarios LEVEL-5 pueden ver el log desde `/api/honeypot-log`.
