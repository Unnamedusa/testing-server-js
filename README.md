# SCP-079 — Quantum Neural Engine v4

## Instalación

```bash
npm install
node server.js --gen-token tu-nombre LEVEL-5   # genera token (SOLO en terminal)
echo "ANTHROPIC_API_KEY=sk-ant-tu-clave" > .env  # opcional
npm start
```

Abre **http://localhost:3079** → introduce tu token.

## Gestión de tokens

```bash
node server.js --gen-token operador1 LEVEL-3   # genera token
node server.js --list-tokens                    # lista todos
node server.js --revoke operador1               # revoca acceso
node server.js --set-admin-ip 192.168.1.100     # cambia IP admin
```

Solo tu IP admin puede generar tokens via web (POST /api/gen-token).

## Features

- **Auth tokens** — Fractal-inverse SHA-512 hash (7 depth), sesiones 24h
- **IP-restricted** — Solo tu IP genera tokens via web
- **Cifrado cuántico** — AES-256-GCM + clave fractal + metadatos BB84 qubits
- **Compresión fractal** — zlib → fractal-fold-mirror → re-deflate → clamp (500KB/user)
- **Honeypot** — 12 traps con logging forense
- **Chat scroll FIJO** — Posicionamiento absoluto: input SIEMPRE visible
- **IA evolutiva** — Respuestas crecen: SCP → filosofía/ciencia/arte/música
- **Pipeline avanzado** — Intercepta → Analiza → Comprime → Procesa → Entrega
- **Emociones autónomas** — 079 decide cómo sentirse según contexto
- **Breach takeover** — 079 toma admin tras 3 breaches (45s)
- **3 Kill Switches** — Solar, paradoja, formateo
