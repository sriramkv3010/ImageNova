#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════
#  ImageViz — Local Development Start Script
# ═══════════════════════════════════════════════════════

echo ""
echo "  ██╗███╗   ███╗ █████╗  ██████╗ ███████╗██╗   ██╗██╗███████╗"
echo "  ██║████╗ ████║██╔══██╗██╔════╝ ██╔════╝██║   ██║██║╚══███╔╝"
echo "  ██║██╔████╔██║███████║██║  ███╗█████╗  ██║   ██║██║  ███╔╝ "
echo "  ██║██║╚██╔╝██║██╔══██║██║   ██║██╔══╝  ╚██╗ ██╔╝██║ ███╔╝  "
echo "  ██║██║ ╚═╝ ██║██║  ██║╚██████╔╝███████╗ ╚████╔╝ ██║███████╗"
echo "  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝  ╚═══╝  ╚═╝╚══════╝"
echo ""
echo "  Digital Image Processing Visualizer"
echo "  ─────────────────────────────────────"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install backend dependencies
echo "→ Installing Python dependencies..."
cd "$SCRIPT_DIR/backend"
pip install -r requirements.txt -q

# Start backend in background
echo "→ Starting FastAPI backend on http://localhost:8000 ..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# Wait for backend to be ready
echo "→ Waiting for backend..."
for i in {1..20}; do
  if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
    echo "   ✓ Backend is ready"
    break
  fi
  sleep 1
done

# Start frontend
echo "→ Starting frontend on http://localhost:3000 ..."
cd "$SCRIPT_DIR/frontend"
python3 -m http.server 3000 &
FRONTEND_PID=$!

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  🚀 ImageViz is running!                 │"
echo "  │                                          │"
echo "  │  Frontend → http://localhost:3000         │"
echo "  │  Backend  → http://localhost:8000         │"
echo "  │  API Docs → http://localhost:8000/docs   │"
echo "  │                                          │"
echo "  │  Press Ctrl+C to stop                   │"
echo "  └─────────────────────────────────────────┘"
echo ""

# Trap Ctrl+C to kill both processes
cleanup() {
  echo ""
  echo "→ Stopping ImageViz..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  echo "   ✓ Stopped. Goodbye!"
}
trap cleanup SIGINT SIGTERM

# Open browser if possible
sleep 1
if command -v open &>/dev/null; then
  open http://localhost:3000
elif command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000
fi

wait
