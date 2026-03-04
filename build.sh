#!/bin/bash
# ────────────────────────────────────────────────────────────────
#  ImageForge — Build Script
#  Rode no VPS UMA VEZ:  bash /opt/imageforge/build.sh
#  Cria a imagem Docker local  imageforge:latest
# ────────────────────────────────────────────────────────────────
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "⚡ ImageForge Build"
echo "   Diretório: $DIR"
echo ""

cd "$DIR"
docker build -t imageforge:latest .

echo ""
echo "✅ Imagem criada: imageforge:latest"
echo ""
echo "Próximo passo: cole o portainer-stack-FINAL.yml no Portainer"
echo "  Mude  img.meudominio.com  →  seu domínio"
echo "  Mude  letsencrypt         →  nome do seu certresolver (se diferente)"
echo "  Clique Deploy"
