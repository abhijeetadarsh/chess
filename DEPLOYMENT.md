# 🚀 Deploying the Chess Analysis Server

This app has two parts that ship as **one** unit:

- **Backend** — FastAPI (Python) + Stockfish + a local SQLite DB (`data/users.db`).
- **Frontend** — a React/Vite app that builds to static files in `frontend/dist/`, which
  **the FastAPI process serves itself**. There is no separate Node server in production.

So deploying = run the Python app behind a reverse proxy, with the frontend pre-built.

---

## 0. Build the frontend (once, anywhere with Node 18+)

The server does **not** need Node if you build the frontend first and copy `frontend/dist/`.

```bash
npm --prefix frontend install
npm --prefix frontend run build      # → frontend/dist/
```

You can do this on your laptop and upload `frontend/dist/` with the rest of the code, **or**
install Node on the server and run it there. (`frontend/dist/` and `frontend/node_modules/`
are git-ignored, so if you deploy via `git pull` you must build on the server.)

---

## 1. Linux (Ubuntu/Debian) — recommended

### 1a. Install system packages

```bash
sudo apt update
sudo apt install -y python3.12 python3.12-venv stockfish nginx
```

`apt install stockfish` puts the engine at **`/usr/games/stockfish`** — note this path, you'll
point the app at it with `STOCKFISH_PATH` (the repo's bundled `stockfish/stockfish.exe` is
Windows-only and is git-ignored).

### 1b. Get the code onto the server

```bash
sudo mkdir -p /opt/chess-analysis
sudo chown $USER /opt/chess-analysis
# via git:
git clone <your-repo-url> /opt/chess-analysis
# …or rsync/scp the project folder up (include frontend/dist if you built locally)
cd /opt/chess-analysis
```

### 1c. Python environment

```bash
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### 1d. Build the frontend (skip if you uploaded `frontend/dist/`)

```bash
# needs Node 18+: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
npm --prefix frontend install
npm --prefix frontend run build
```

### 1e. Smoke-test

```bash
STOCKFISH_PATH=/usr/games/stockfish .venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
# in another shell:
curl -s localhost:8000/health      # -> {"status":"ok","stockfish_found":true,...}
```
Stop it with Ctrl+C once `/health` looks good.

### 1f. Run it as a service (systemd)

Create `/etc/systemd/system/chess-analysis.service`:

```ini
[Unit]
Description=Chess Analysis Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/chess-analysis
Environment="STOCKFISH_PATH=/usr/games/stockfish"
Environment="ENGINE_THREADS=2"
Environment="ENGINE_POOL_SIZE=2"
ExecStart=/opt/chess-analysis/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /opt/chess-analysis   # so it can write data/users.db
sudo systemctl daemon-reload
sudo systemctl enable --now chess-analysis
sudo systemctl status chess-analysis      # check it's running
journalctl -u chess-analysis -f           # live logs
```

> **Why `--workers 1`?** Analysis is CPU-bound and each worker spawns its own pool of
> Stockfish processes (`ENGINE_POOL_SIZE` × `ENGINE_THREADS` threads). Start with 1 worker and
> tune `ENGINE_THREADS` to your core count; add a worker only if you have cores to spare.

### 1g. Reverse proxy (nginx)

Create `/etc/nginx/sites-available/chess-analysis`:

```nginx
server {
    listen 80;
    server_name your-domain.com;       # or your server's IP

    client_max_body_size 4m;           # PGNs can be biggish

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # The /analyze/stream endpoint streams move-by-move (NDJSON) —
        # turn off buffering so results arrive live, and allow long analyses.
        proxy_buffering off;
        proxy_read_timeout 600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/chess-analysis /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

The app is now live on **http://your-domain.com**.

### 1h. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com      # auto-edits nginx + auto-renews
```

---

## 2. Configuration (environment variables)

Set these in the systemd unit (or your shell). All optional except the Stockfish path on Linux.

| Variable | Default | Notes |
|----------|---------|-------|
| `STOCKFISH_PATH` | `stockfish/stockfish.exe` | **Set to `/usr/games/stockfish` on Linux.** |
| `ENGINE_THREADS` | CPU count − 1 | Threads per Stockfish process. |
| `ENGINE_HASH_MB` | 256 | Engine hash table (MB). |
| `ENGINE_POOL_SIZE` | 2 | Warm Stockfish processes kept per worker. |

---

## 3. Updating a deployment

```bash
cd /opt/chess-analysis
git pull                                   # or re-upload
. .venv/bin/activate && pip install -r requirements.txt
npm --prefix frontend install && npm --prefix frontend run build   # rebuild UI
sudo systemctl restart chess-analysis
```

`data/users.db` is preserved across updates (it's git-ignored). Back it up before big changes.

---

## 4. Docker (alternative, bundles everything)

Create `Dockerfile` in the project root:

```dockerfile
# ---- build frontend ----
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- runtime ----
FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/*
ENV STOCKFISH_PATH=/usr/games/stockfish
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./
COPY --from=web /web/dist ./frontend/dist
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t chess-analysis .
docker run -d -p 8000:8000 -v chess_data:/app/data --name chess chess-analysis
```

(The named volume keeps `data/users.db` across container restarts.) Put nginx/HTTPS in front
the same way as section 1g–1h, proxying to the container's port 8000.

---

## 5. Windows Server (alternative)

1. Install Python 3.12 and Node 18+.
2. `python -m venv .venv` → `.venv\Scripts\pip install -r requirements.txt`.
3. `python setup_stockfish.py` (downloads `stockfish/stockfish.exe`) — the default
   `STOCKFISH_PATH` already points here, so no env var needed.
4. `npm --prefix frontend install; npm --prefix frontend run build`.
5. Run `.venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8000` (no `--reload`).
   To run as a background service, wrap it with **NSSM** (`nssm install ChessAnalysis ...`)
   and put **IIS** (with the URL Rewrite/ARR reverse proxy) or nginx-for-Windows in front for HTTPS.

---

## 6. CI/CD with GitHub Actions (HELD — using Jenkins instead, see §7)

> This workflow is kept for reference but its auto-trigger is disabled. The active pipeline
> is **Jenkins** (§7). Skip to §7 unless you want external GitHub-hosted CI.

`.github/workflows/deploy.yml` builds the frontend and deploys to your server over SSH on
push to `main`. One-time setup:

**Step 1 — bootstrap the server** (installs Stockfish, creates the systemd service, lets CI
restart it; add `DOMAIN=...` to also configure nginx):

```bash
git clone <your-repo-url> /opt/chess-analysis
DOMAIN=chess.example.com sudo -E bash /opt/chess-analysis/scripts/server-setup.sh
```

**Step 2 — create an SSH deploy key** (no passphrase) and authorise its *public* half on the
server:

```bash
ssh-keygen -t ed25519 -f deploy_key -N ""
ssh-copy-id -i deploy_key.pub  YOUR_USER@YOUR_SERVER
```

**Step 3 — add repository secrets** in GitHub → *Settings → Secrets and variables → Actions*:

| Secret | Example | What it is |
|--------|---------|------------|
| `SSH_HOST` | `203.0.113.10` | server IP / hostname |
| `SSH_USER` | `ubuntu` | the deploy user (the one you ran setup as) |
| `SSH_PRIVATE_KEY` | *(paste the whole `deploy_key` file)* | the **private** key |
| `DEPLOY_PATH` | `/opt/chess-analysis` | where the app lives on the server |
| `SSH_PORT` | `22` | optional (defaults to 22) |

**Step 4 — push.** `git push origin main` runs the pipeline: build UI → rsync project →
install Python deps → restart service → `/health` check.

> The workflow never touches `data/` (your user DB), `stockfish/`, or `.venv` on the server —
> they're excluded from the sync, so user accounts and the engine survive every deploy.

---

## 7. CI/CD with Jenkins + conda (active, same-server)

Jenkins runs **on tomiarb.com**, so it deploys locally — no SSH keys/secrets. The pipeline
(`Jenkinsfile`) builds the conda env (Python **and** Node), builds the frontend, syncs to the
app dir, and restarts the service. The app runs as the **jenkins** user from a conda **prefix
env** at `/opt/chess-analysis-env` (so jenkins never writes into abhijeet's home).

**Step 1 — one-time server setup** (as root on tomiarb.com). Copy the repo or just the script
over, then run it:

```bash
sudo bash /opt/chess-analysis/scripts/jenkins-server-setup.sh
# (or, if conda is elsewhere) CONDA=/path/to/miniconda3 sudo -E bash .../jenkins-server-setup.sh
```

This installs Stockfish, creates `/opt/chess-analysis` + `/opt/chess-analysis-env` (owned by
jenkins), grants jenkins read/exec on the conda install, writes the systemd unit
(`ExecStart=/opt/chess-analysis-env/bin/uvicorn …`), and gives jenkins a NOPASSWD rule to
restart only that service.

**Step 2 — create the Jenkins job** at https://jenkins.tomiarb.com:

- *New Item → Pipeline*.
- **Pipeline → Definition: “Pipeline script from SCM”**, SCM **Git**,
  Repo `git@github.com:abhijeetadarsh/chess.git`, **Script Path:** `Jenkinsfile`.
- Add a **credential** Jenkins can use to read the private repo (an SSH key whose public half
  is added to the repo’s *Deploy keys*, or a GitHub token).
- (Optional) enable **GitHub hook trigger** / poll SCM so each push to `main` auto-builds.

**Step 3 — build.** Click *Build Now*. The first run creates the env at
`/opt/chess-analysis-env`, deploys, and starts the service. Watch the stage view; the
**Health check** stage hitting `/health` confirms success.

**Step 4 — nginx** (you already terminate TLS for `jenkins.tomiarb.com`; add a server block
for the app, e.g. `chess.tomiarb.com`):

```nginx
server {
    listen 80;
    server_name chess.tomiarb.com;
    client_max_body_size 4m;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;        # NDJSON /analyze/stream must not be buffered
        proxy_read_timeout 600s;
    }
}
```
Then `sudo certbot --nginx -d chess.tomiarb.com` for HTTPS.

> Every deploy preserves `data/` (user DB), `stockfish/`, and the env — they're excluded from
> the rsync. To change CPU usage, edit `ENGINE_THREADS` in the systemd unit and
> `sudo systemctl daemon-reload && sudo systemctl restart chess-analysis`.

---

## Production checklist

- [ ] `frontend/dist/` exists (built) — visiting `/` shows the app, not the "Frontend not built" notice.
- [ ] `GET /health` returns `"stockfish_found": true`.
- [ ] Run **without** `--reload`, behind nginx, over HTTPS.
- [ ] `data/` is writable by the service user and **backed up** (it holds all user accounts).
- [ ] `proxy_buffering off` is set so streaming analysis arrives live.
- [ ] `ENGINE_THREADS` tuned to the server's CPU.
