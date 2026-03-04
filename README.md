# ⚡ ImageForge

**Conversor e otimizador de imagens** — Node.js + React + Sharp + Docker + Traefik

---

## 🏗️ Arquitetura

```
Browser → Traefik (HTTPS) → ImageForge Container (porta 8080)
                                   ├── Express (API /api/*)
                                   └── Vite Build (arquivos estáticos React)
```

**1 único container** serve tudo: frontend buildado + API backend. O Traefik só precisa rotear um serviço.

---

## 🚀 Deploy no Portainer (passo a passo)

### Pré-requisitos

- VPS Hetzner com Ubuntu
- Docker instalado
- Portainer instalado e acessível
- Domínio apontando para o IP do servidor (ex: `img.seudominio.com → 1.2.3.4`)
- Portas 80 e 443 abertas no firewall

### Escolha o cenário:

| Cenário | Compose |
|---|---|
| **A** — Já tenho Traefik rodando em outro Stack | `compose-A-traefik-externo.yml` |
| **B** — Quero subir Traefik + App juntos (tudo em um) | `compose-B-traefik-mesmo-stack.yml` |

---

## 📋 Cenário A — Traefik já existente

### 1. Verificar/criar rede externa

```bash
# Ver redes existentes
docker network ls

# Se não existir traefik_public:
docker network create traefik_public
```

### 2. Garantir que seu Traefik usa essa rede e tem o certresolver `letsencrypt`

No compose do seu Traefik, deve ter algo como:
```yaml
networks:
  traefik_public:
    external: true
# E nas configurações do Traefik:
--certificatesresolvers.letsencrypt.acme.email=SEU_EMAIL
--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json
--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web
```

### 3. Portainer → Stacks → Add Stack

- Nome: `imageforge`
- Cole o conteúdo de `compose-A-traefik-externo.yml`
- **Altere as variáveis:**
  - `DOMAIN: img.seudominio.com`
  - `LETSENCRYPT_EMAIL: seu@email.com`

### 4. Deploy!

---

## 📋 Cenário B — Traefik + App no mesmo Stack

### 1. Portainer → Stacks → Add Stack

- Nome: `imageforge`
- Cole o conteúdo de `compose-B-traefik-mesmo-stack.yml`

### 2. **Altere no arquivo colado:**
```yaml
# Linha do email no ACME:
- "--certificatesresolvers.letsencrypt.acme.email=SEU@EMAIL.COM"

# Labels do app:
- "traefik.http.routers.imageforge.rule=Host(`SEU.DOMINIO.COM`)"
```

### 3. Deploy!

---

## 🔍 Ver logs

```bash
# Via Portainer: Stacks → imageforge → Logs

# Via terminal:
docker logs imageforge_imageforge_1 -f
docker logs imageforge_traefik_1 -f
```

---

## ✅ Testar

```bash
# Health check
curl https://img.seudominio.com/health
# Esperado: {"status":"ok","ts":"..."}

# Verificar certificado SSL
curl -I https://img.seudominio.com
```

---

## 🔧 Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `PORT` | `8080` | Porta interna do app |
| `MAX_FILE_MB` | `25` | Limite por arquivo (MB) |
| `MAX_BATCH_MB` | `200` | Limite total do lote (MB) |
| `CLEANUP_MINUTES` | `60` | TTL dos arquivos temporários |
| `CONCURRENCY` | `3` | Imagens processadas em paralelo |
| `TMP_DIR` | `/tmp/imageforge` | Diretório temporário |

---

## 🐛 Troubleshooting

### Certificado não emite

```bash
# Verificar se porta 80 está acessível externamente
curl http://img.seudominio.com

# Ver logs do Traefik para erros ACME
docker logs imageforge_traefik_1 2>&1 | grep -i acme

# Testar com servidor staging primeiro (sem rate limit)
# Descomente a linha caserver no compose:
# - "--certificatesresolvers.letsencrypt.acme.caserver=https://acme-staging-v02.api.letsencrypt.org/directory"
```

### App não aparece na rede do Traefik

```bash
# Verificar se container está na rede correta
docker network inspect traefik_public

# Verificar labels
docker inspect imageforge_imageforge_1 | grep -A 20 Labels
```

### Erro "network not found"

```bash
# Criar rede manualmente (Cenário A)
docker network create traefik_public

# Ou pelo Portainer: Networks → Add Network
```

### Porta 80/443 em uso

```bash
# Ver o que está usando as portas
ss -tlnp | grep -E ':80|:443'
sudo systemctl stop nginx apache2 # se necessário
```

### App demora para processar imagens grandes

Aumente o `CONCURRENCY` no compose. Com 2GB RAM, `CONCURRENCY=5` funciona bem.

---

## 📁 Estrutura do projeto

```
imageforge/
├── backend/
│   ├── package.json
│   └── src/
│       ├── server.js       # Express + serve static
│       ├── queue.js        # Sharp processing + paralelismo
│       ├── cleanup.js      # Cron de limpeza de /tmp
│       ├── utils.js
│       └── routes/
│           ├── convert.js  # POST /api/convert
│           └── download.js # GET /api/download/:batchId/:file
│                           # GET /api/download-zip/:batchId
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── styles.css
├── docker/
│   ├── compose-A-traefik-externo.yml
│   └── compose-B-traefik-mesmo-stack.yml
├── Dockerfile              # Multi-stage build
└── README.md
```

---

## 🏃 Desenvolvimento local

```bash
# Backend
cd backend && npm install
PORT=8080 node src/server.js

# Frontend (outro terminal)
cd frontend && npm install
npm run dev  # proxy para localhost:8080

# Acesse: http://localhost:5173
```

---

## 📦 Build e push da imagem

```bash
# Build
docker build -t ghcr.io/SEU_USUARIO/imageforge:latest .

# Push (GitHub Container Registry)
echo $GITHUB_TOKEN | docker login ghcr.io -u SEU_USUARIO --password-stdin
docker push ghcr.io/SEU_USUARIO/imageforge:latest
```

---

## API Reference

| Endpoint | Método | Descrição |
|---|---|---|
| `GET /health` | GET | Health check |
| `POST /api/convert` | POST | Converte imagens (multipart/form-data) |
| `GET /api/download/:batchId/:filename` | GET | Download arquivo individual |
| `GET /api/download-zip/:batchId` | GET | Download ZIP do batch |

### POST /api/convert

**Form fields:**
- `images` (file[]): arquivos de imagem
- `options` (string JSON):

```json
{
  "format": "webp",
  "quality": 85,
  "keepOriginal": false,
  "keepExif": false,
  "forceSquare": false
}
```

**Response:**
```json
{
  "batchId": "uuid",
  "results": {
    "foto.jpg": [
      {
        "label": "2560px",
        "filename": "foto_2560px.webp",
        "width": 2560,
        "height": 1440,
        "size": 245000,
        "origSize": 4500000,
        "origWidth": 5000,
        "origHeight": 2812,
        "format": "webp"
      }
    ]
  }
}
```
