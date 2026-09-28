# Hetzner Deployment — hel1 · CX22 · Coolify · No Domain (IP-only)

> Replaces `DEPLOY.md` (Azure + AWS RDS + S3). This path is **local-first**: you test `docker compose` on your machine, then repeat the same compose on Hetzner via plain SSH + Coolify. No `hcloud` CLI, minimal `boto3`.

---

## 0. Prerequisites

- Hetzner Cloud account, project `invision`
- SSH key (`~/.ssh/id_ed25519.pub`) — same key for Console + Coolify Git deploy
- Google `GEMINI_API_KEY` (kept external — only outbound HTTPS to `generativelanguage.googleapis.com`)
- Local: Docker + compose plugin, `openssl` for secrets

Generate secrets (once):

```bash
openssl rand -hex 32  # → DB_PASSWORD
openssl rand -hex 32  # → JWT_SECRET
```

---

## 1. Create VPS (Console only, no `hcloud` CLI)

1. Hetzner Console → New project `invision` → Add Server
   - Location: **`hel1` (Helsinki)**
   - Image: `Ubuntu 24.04`
   - Type: **`CX22` (2 vCPU, 4 GB, 40 GB NVMe, €5.83/mo)**
   - SSH key: paste your public key
   - Enable **Backups** (20%, 7 daily images)
   - Firewall: create `invision-fw` (see §2) and attach
   - Create → note **IPv4** (e.g. `65.21.12.34`) + IPv6

2. Firewall `invision-fw` (Console → Firewalls):

| Dir | Port | Source | Why |
|---|---|---|---|
| In | 22 | `YOUR_IP/32` | SSH only from you |
| In | 80 | `0.0.0.0/0`, `::/0` | HTTP + Coolify/Traefik |
| In | 443 | `0.0.0.0/0`, `::/0` | HTTPS/WSS (used when you later add `nip.io`) |
| Out | all | `0.0.0.0/0` | Gemini API, apt, GHCR |

Do **not** expose `3000/8000/5432`.

---

## 2. Install Coolify (plain SSH)

```bash
ssh root@<IPv4>
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# wait ~2 min; it prints http://<IPv4>:8000
# open http://<IPv4>:8000 → create admin account

# harden host (same SSH session):
adduser deploy --disabled-password && usermod -aG docker,sudo deploy
mkdir -p /home/deploy/.ssh && cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
apt update && apt install -y unattended-upgrades fail2ban
systemctl enable --now unattended-upgrades fail2ban
```

Coolify now manages **Traefik** (its ingress) — you don’t need to run the repo’s `Caddyfile` on Hetzner unless you prefer Caddy (both work; this doc uses Coolify’s Traefik).

---

## 3. Wire Services in Coolify UI

Console: `http://<IPv4>:8000` → Project `invision` → Environment `production`.

### 3.1 Postgres 16

Add Service → **PostgreSQL 16** → name `db` → set `POSTGRES_USER=postgres`, `POSTGRES_DB=postgres`, `POSTGRES_PASSWORD=<DB_PASSWORD>`, volume `pgdata` (default). Note internal host is `db` (Coolify DNS).

### 3.2 MinIO (optional — enables “both storages”)

Add Service → **MinIO** → set `MINIO_ROOT_USER=minioadmin`, `MINIO_ROOT_PASSWORD=<strong>` → after deploy, open MinIO console (`:9001`) → create bucket `invision`, policy `download` if you want public reads. If you skip this, keep `AWS_S3_BUCKET` empty and the backend uses local volume `uploads/` (`backend/app/infrastructure/s3_client.py:14-18`) — both are valid; toggle is one env var.

### 3.3 Backend (FastAPI)

Add Resource → **Application** → Git (paste repo URL + deploy key if private) →

- Build: Dockerfile `backend/Dockerfile` (already `alembic upgrade head && uvicorn … --workers 1 --ws websockets` `backend/Dockerfile:41`)
- Domain: `http://<IPv4>` path `/api` and `/ws` (or Coolify’s “proxy” target `backend:8000`). If you later use `<IPv4>.nip.io`, change domain there and Coolify re-issues TLS.
- Env (paste from `backend/.env.example`):

```
GEMINI_API_KEY=...
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=postgres
DB_USE_IAM_AUTH=false
AWS_REGION=eu-west-1
AWS_S3_BUCKET=              # empty = local volume; or invision if MinIO
AWS_ENDPOINT_URL=           # or http://minio:9000 when MinIO
JWT_SECRET=...
CORS_ORIGINS=http://<IPv4>
# or later: https://<IPv4>.nip.io
ADMIN_CREATION_SECRET=
```

### 3.4 Frontend (Next.js)

Same Git source → Dockerfile `frontend/Dockerfile` (`output: 'standalone'` `frontend/next.config.mjs:12`) →

- Build args: `NEXT_PUBLIC_API_URL=http://<IPv4>` (or `https://<IPv4>.nip.io`), `NEXT_PUBLIC_WS_URL=ws://<IPv4>` (or `wss://…`), `NEXT_PUBLIC_FEATURE_FLAGS=`
- Domain: `http://<IPv4>` `/`

Push to `main` → Coolify pulls and builds **on the VPS** (no GHCR). Every push auto-deploys.

---

## 4. Local-First Test (before touching Hetzner)

This repo now has `docker-compose.yml:45` + `docker-compose.prod.yml` + `Caddyfile`. Validate locally:

```bash
cp backend/.env.example backend/.env   # set DB_PASSWORD, JWT_SECRET, GEMINI_API_KEY
# DB_HOST=db, DB_USE_IAM_AUTH=false already in example

# default (volume storage):
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend  # alembic upgrade head
docker exec -it <db> psql -U postgres -c "\dt"  # users, sessions, rating_events

# seed demo (admin@invision.demo + 3 applicants):
docker exec invision-backend-1 python -m app.scripts.seed

# with MinIO instead:
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile minio up --build -d
# then set AWS_S3_BUCKET=invision, AWS_ENDPOINT_URL=http://minio:9000 in backend/.env and restart backend

# tests (from host):
cd backend && pip install -r requirements-dev.txt && python -m pytest

# manual:
curl http://localhost/docs                # via direct 8000
curl http://localhost:80/docs             # via Caddy
curl -X POST http://localhost:80/api/register -H "Content-Type: application/json" -d '{"name":"t","email":"t@t.t","password":"x"}'
wscat -c ws://localhost/ws/<sessionId>?token=<jwt>
# browser: http://localhost → /signup → /apply → /apply/interview
```

Gates before Hetzner: migrations OK, seed OK, `pytest` ~87 green, `POST /api/upload-recording` → `GET /api/recording/{id}` round-trip, `GET /api/admin/committee` returns grid, WS check-in after ~20s (`backend/app/config.py:24`).

---

## 5. No-Domain → TLS Later (free, no purchase)

No domain today = `http://<IPv4>` + `ws://<IPv4>`. When you want TLS without buying a domain:

1. Pick `https://<IPv4>.nip.io` (e.g. `65.21.12.34.nip.io` → resolves to `65.21.12.34` via `nip.io` wildcard DNS — or `sslip.io` same).
2. In Coolify, change both backend and frontend domains to `<IPv4>.nip.io` (and add `www.<IPv4>.nip.io` if you like) → Coolify/Traefik obtains Let’s Encrypt cert automatically.
3. Update build args: `NEXT_PUBLIC_API_URL=https://<IPv4>.nip.io`, `NEXT_PUBLIC_WS_URL=wss://<IPv4>.nip.io` and env `CORS_ORIGINS=https://<IPv4>.nip.io`, redeploy frontend.

No code change.

---

## 6. Backups

- **Hetzner Backups:** enabled at server create → 7 daily full images.
- **Coolify:** Project → Backups → enable daily Postgres dumps.
- **Off-site (optional):** attach a **Storage Box BX11** (100 GB, €3.40/mo) and add cron on VPS:

```bash
0 3 * * * deploy sh -c 'docker exec invision-db-1 pg_dump -U "$DB_USER" "$DB_NAME" | gzip > /tmp/db-$(date +\%F).sql.gz && rclone copy /tmp/db-$(date +\%F).sql.gz storagebox:invision/backups/ --config /home/deploy/.config/rclone/rclone.conf'
```

`uploads/` are on volume `uploads` (`/var/lib/docker/volumes/invision_uploads/_data`) or MinIO volume — snapshot the volume or `tar czf` it nightly.

---

## 7. Verify on Hetzner

```bash
ssh deploy@<IPv4> "docker ps && docker logs invision-backend-1 --tail 20"
curl http://<IPv4>/docs
curl http://<IPv4>/api/admin/committee -H "Authorization: Bearer <admin JWT>"
wscat -c ws://<IPv4>/ws/<sessionId>?token=<jwt>
```

Browser: `http://<IPv4>` → `/admin` → committee grid shows demo applicants.

---

## 8. Costs (hel1)

| Item | €/mo |
|---|---|
| CX22 (2 vCPU/4 GB/40 GB) | 5.83 |
| Backups (20%) | 1.17 |
| Storage Box BX11 (optional) | 3.40 |
| Coolify | 0 |
| **Total** | **7.00 (11.00 with off-site)** |

---

## 9. Retire Azure

After Hetzner is green: keep old `DEPLOY.md` for 7 days, then delete resource group `invision-rg`, ACR `invisionacr`, and S3 bucket `invision-046573763502-eu-west-1-an` — all replaced.

