// Jenkins pipeline for the Chess Analysis Server.
// Runs on the same host as the app (tomiarb.com): builds the frontend, sets up a
// Python venv, syncs to the app dir, and restarts the systemd service — no SSH, no conda.
//
// Prereqs (one-time):
//   * sudo bash scripts/jenkins-server-setup.sh         (stockfish, dirs, systemd, sudoers)
//   * Manage Jenkins → Plugins: install "NodeJS"
//   * Manage Jenkins → Tools → NodeJS installations: add one named "node22" (auto-install 22.x)
// Job type: "Pipeline script from SCM" → this repo → Script Path: Jenkinsfile

pipeline {
  agent any

  tools {
    nodejs 'node22'        // must match the NodeJS tool name configured in Jenkins
  }

  environment {
    APP_DIR = '/opt/chess-analysis'
    SERVICE = 'chess-analysis'
  }

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 20, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Build frontend') {
      steps {
        sh '''
          set -e
          node --version
          cd frontend
          npm ci
          npm run build          # = tsc -b && vite build -> frontend/dist
        '''
      }
    }

    stage('Deploy to app dir') {
      steps {
        sh '''
          set -e
          mkdir -p "$APP_DIR"
          rsync -a --delete \
            --exclude='.git' \
            --exclude='frontend/node_modules' \
            --exclude='**/__pycache__' \
            --exclude='data' \
            --exclude='stockfish' \
            --exclude='.venv' \
            ./ "$APP_DIR/"
        '''
      }
    }

    stage('Backend venv') {
      steps {
        sh '''
          set -e
          cd "$APP_DIR"
          python3 -m venv .venv
          . .venv/bin/activate
          pip install --upgrade pip --quiet
          pip install -r requirements.txt --quiet
        '''
      }
    }

    stage('Restart service') {
      steps {
        sh 'sudo systemctl restart "$SERVICE"'
      }
    }

    stage('Health check') {
      steps {
        sh '''
          set -e
          sleep 4
          curl -fsS http://127.0.0.1:8000/health
          echo
          echo "✅ $SERVICE is healthy"
        '''
      }
    }
  }

  post {
    success { echo "Deployed ${SERVICE}." }
    failure { echo "Deploy failed — see the failing stage above." }
  }
}
