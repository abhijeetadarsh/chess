#!/usr/bin/env bash
#
# One-time server setup for the Jenkins + conda deployment on tomiarb.com.
# Run ONCE as root (Jenkins handles every deploy after this):
#
#     sudo bash scripts/jenkins-server-setup.sh
#
# Override any of these if your layout differs:
#     CONDA=/home/abhijeet/miniconda3  JENKINS_USER=jenkins  APP_DIR=/opt/chess-analysis \
#     ENV_PREFIX=/opt/chess-analysis-env  sudo -E bash scripts/jenkins-server-setup.sh
set -euo pipefail

JENKINS_USER="${JENKINS_USER:-jenkins}"
CONDA="${CONDA:-/home/abhijeet/miniconda3}"
APP_DIR="${APP_DIR:-/opt/chess-analysis}"
ENV_PREFIX="${ENV_PREFIX:-/opt/chess-analysis-env}"
STOCKFISH_PATH="${STOCKFISH_PATH:-/usr/games/stockfish}"
SERVICE=chess-analysis

[[ $EUID -eq 0 ]] || { echo "Please run with sudo."; exit 1; }
[[ -x "$CONDA/bin/conda" ]] || { echo "ERROR: conda not found at $CONDA/bin/conda — set CONDA=..."; exit 1; }
id "$JENKINS_USER" &>/dev/null || { echo "ERROR: user '$JENKINS_USER' does not exist."; exit 1; }

echo "==> Installing Stockfish + rsync"
apt-get update
apt-get install -y stockfish rsync curl acl

echo "==> Creating jenkins-owned directories"
mkdir -p "$APP_DIR" "$APP_DIR/data" "$ENV_PREFIX"
chown -R "$JENKINS_USER":"$JENKINS_USER" "$APP_DIR" "$ENV_PREFIX"

echo "==> Granting $JENKINS_USER read/exec on the conda install"
# jenkins must traverse into the home that holds conda and read the install.
# (env packages are written to $ENV_PREFIX + \$HOME/.conda-pkgs, never into $CONDA.)
CONDA_HOME="$(dirname "$CONDA")"
if command -v setfacl >/dev/null; then
  setfacl -m "u:$JENKINS_USER:--x" "$CONDA_HOME"
else
  chmod o+x "$CONDA_HOME"
fi

echo "==> Writing systemd unit: /etc/systemd/system/$SERVICE.service"
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Chess Analysis Server
After=network.target

[Service]
Type=simple
User=$JENKINS_USER
WorkingDirectory=$APP_DIR
Environment="STOCKFISH_PATH=$STOCKFISH_PATH"
Environment="ENGINE_THREADS=2"
Environment="ENGINE_POOL_SIZE=2"
ExecStart=$ENV_PREFIX/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 1
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$SERVICE"

echo "==> Allowing $JENKINS_USER to restart the service without a password"
cat > "/etc/sudoers.d/$SERVICE" <<SUDO
$JENKINS_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart $SERVICE, /bin/systemctl restart $SERVICE
SUDO
chmod 440 "/etc/sudoers.d/$SERVICE"

echo
echo "==> Server prepared. The service is enabled but won't start until the first"
echo "    Jenkins build creates the env at $ENV_PREFIX and deploys the code."
echo
echo "    Next: create a Jenkins Pipeline job (SCM = your repo, Script Path = Jenkinsfile)"
echo "    and add an nginx server block for the app (proxy_pass http://127.0.0.1:8000;"
echo "    proxy_buffering off;) — see DEPLOYMENT.md section 7."
