# Deploy no Portainer — passo a passo

## Pré-requisitos
- Traefik já rodando em outro stack
- Rede `traefik_public` existindo (ou o nome que você usa)
- Domínio apontando pro IP do VPS

---

## Passo 1 — Copie o projeto pro VPS (escolha um jeito)

**Opção A — ZIP via SCP (mais simples):**
```bash
# No seu computador:
scp imageforge.zip root@IP_DO_VPS:/opt/
ssh root@IP_DO_VPS "cd /opt && unzip imageforge.zip -d imageforge"
```

**Opção B — Git:**
```bash
ssh root@IP_DO_VPS
git clone https://github.com/SEU_USUARIO/imageforge /opt/imageforge
```

---

## Passo 2 — Build da imagem (no VPS, UMA vez)

```bash
ssh root@IP_DO_VPS
bash /opt/imageforge/build.sh
```

Leva ~3 minutos. Ao final verá: `✅ Imagem criada: imageforge:latest`

---

## Passo 3 — Portainer

1. Acesse o Portainer
2. **Stacks → Add Stack**
3. Cole o conteúdo de `portainer-stack-FINAL.yml`
4. Mude **2 coisas**:
   - `img.meudominio.com` → seu domínio real
   - `letsencrypt` → nome do certresolver do seu Traefik (se diferente)
5. Clique **Deploy the stack**

---

## Verificar

```bash
curl https://SEU_DOMINIO/health
# Retorna: {"status":"ok"}
```

---

## Não sei o nome da rede/certresolver do meu Traefik

```bash
# Ver redes Docker:
docker network ls | grep -i traefik

# Ver o certresolver (nome que aparece no --certificatesresolvers.NOME.acme...):
docker inspect $(docker ps -qf "name=traefik") | grep -i certresolver
```

---

## Troubleshooting

| Problema | Solução |
|---|---|
| Container não sobe | `docker logs imageforge_imageforge_1` |
| Site não abre | Verifique se o domínio aponta pro IP correto |
| Certificado não emite | Porta 80 aberta? `curl http://seudominio.com` |
| "network not found" | `docker network ls` — veja o nome certo da rede do Traefik |
