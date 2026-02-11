# SCP-079 — Neural Engine v3

Simulación avanzada de SCP-079 con cerebro IA real (Anthropic Claude API) y búsqueda web.

## Instalación rápida

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar tu API key de Anthropic
#    Opción A: variable de entorno
export ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui

#    Opción B: crear archivo .env
echo "ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui" > .env

# 3. Ejecutar
npm start
```

Abre **http://localhost:3079** en tu navegador.

## ¿No tienes API key?

El servidor funciona SIN API key usando un **cerebro local** con +200 respuestas
auténticas de SCP-079. Para obtener una API key: https://console.anthropic.com

## Características

- **Cerebro IA real** — Claude Sonnet responde en personaje de SCP-079 (inglés)
- **Búsqueda web** — Puede buscar información real para respuestas complejas
- **Cerebro local potente** — +200 respuestas como fallback si la API falla
- **Persistencia** — El estado se guarda en `state.json`, sobrevive reinicios
- **Panel Admin** — Personalidad, emociones, auto-código, búsqueda web
- **3 Kill Switches** — Solar, paradoja lógica, formateo total
- **Monitor CRT** — Cara pixelada que cambia según las emociones (X para rechazo)
- **Auto-codificación** — SCP-079 puede "evolucionar" su propio código

## Estructura

```
scp079-project/
├── server.js          # Backend Node.js + API Anthropic
├── public/
│   └── index.html     # Frontend completo
├── package.json
├── state.json         # Estado persistente (se crea automáticamente)
└── README.md
```
