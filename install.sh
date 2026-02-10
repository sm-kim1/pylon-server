#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
step()    { echo -e "\n${BLUE}==>${NC} $*"; }

version_ge() {
  printf '%s\n%s' "$2" "$1" | sort -V -C
}

echo ""
echo "=========================================="
echo "  Pylon Server Installer"
echo "=========================================="
echo ""

step "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  error "Node.js is not installed."
  echo "  Install Node.js 20+: https://nodejs.org/"
  echo "  Or via nvm: nvm install 20"
  exit 1
fi

NODE_VER="$(node -v | sed 's/^v//')"
if ! version_ge "$NODE_VER" "20.0.0"; then
  error "Node.js 20+ required. Current: v${NODE_VER}"
  exit 1
fi
success "Node.js v${NODE_VER}"

if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found. Installing..."
  npm install -g pnpm@9
fi

PNPM_VER="$(pnpm -v)"
if ! version_ge "$PNPM_VER" "9.0.0"; then
  error "pnpm 9+ required. Current: ${PNPM_VER}"
  echo "  Run: npm install -g pnpm@9"
  exit 1
fi
success "pnpm v${PNPM_VER}"

step "Installing dependencies..."
cd "$SCRIPT_DIR"
pnpm install

step "Building shared types..."
pnpm --filter @pylon/shared build

step "Building server..."
pnpm --filter pylon-server build

step "Building web frontend..."
pnpm --filter @pylon/web build

echo ""
echo "=========================================="
echo -e "  ${GREEN}Installation complete!${NC}"
echo "=========================================="
echo ""
echo "  Start server (production):"
echo "    cd server && npm run start"
echo ""
echo "  Start development mode:"
echo "    pnpm dev"
echo ""
echo "  Web static files:"
echo "    web/dist/"
echo ""
echo "  Environment variables:"
echo "    PORT=3000          Server port (default: 3000)"
echo "    NODE_ENV=production"
echo "    LOG_LEVEL=info     trace|debug|info|warn|error|fatal"
echo ""
