// Jenkins pipeline for the Chess Analysis Server.
// Runs on the same host as the app (tomiarb.com): builds the frontend and the
// conda env, syncs to the app dir, and restarts the systemd service — no SSH.
//
// One-time prep on the server:  sudo bash scripts/jenkins-server-setup.sh
// Job type: "Pipeline script from SCM" → this repo → Script Path: Jenkinsfile

pipeline {
  agent any

  environment {
    CONDA      = '/home/abhijeet/miniconda3'   // conda install (read/exec for jenkins)
    ENV_PREFIX = '/opt/chess-analysis-env'     // prefix env, owned by jenkins
    APP_DIR    = '/opt/chess-analysis'         // where the app is served from
    SERVICE    = 'chess-analysis'              // systemd unit name
  }

  options {
    disableConcurrentBuilds()
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Conda env (Python + Node)') {
      steps {
        sh '''
          set -e
          export CONDA_PKGS_DIRS="$HOME/.conda-pkgs"   # jenkins-writable cache
          "$CONDA/bin/conda" env update -p "$ENV_PREFIX" -f environment.yml --prune
        '''
      }
    }

    stage('Build frontend') {
      steps {
        sh '''
          set -e
          cd frontend
          "$CONDA/bin/conda" run -p "$ENV_PREFIX" npm ci
          "$CONDA/bin/conda" run -p "$ENV_PREFIX" npm run build   # -> frontend/dist
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
            ./ "$APP_DIR/"
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
