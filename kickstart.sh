#!/bin/bash

# =============================================================
# GROOT — 100/100 Unified Kickstart Script
# =============================================================

set -e

echo "🌳 Starting GROOT Unified Setup..."

# 1. Check for Docker
if ! [ -x "$(command -v docker)" ]; then
  echo "❌ Error: Docker is not installed. Please install Docker to continue." >&2
  exit 1
fi

# 2. Infrastructure
echo "🐳 Starting Infrastructure (Postgres, Redis)..."
npm run up

# 3. Environment
if [ ! -f .env ]; then
  echo "📝 Creating .env from template..."
  cp .env.example .env
  echo "⚠️  ACTION REQUIRED: Open .env and add your GEMINI_API_KEY."
fi

# 4. Dependencies
echo "📦 Installing Monorepo Dependencies..."
npm install

# 5. Database Setup
echo "🗄️  Running Migrations..."
npm run db:migrate

# 6. Sample Data
echo "📚 Ingesting Sample Curriculum..."
npm run ingest:sample

echo ""
echo "✅ SETUP COMPLETE!"
echo "-------------------------------------------------------"
echo "🚀 Run 'npm run dev' to start the entire system."
echo "🌍 Web UI: http://localhost:3000"
echo "🛠 Adminer: http://localhost:8081"
echo "-------------------------------------------------------"
