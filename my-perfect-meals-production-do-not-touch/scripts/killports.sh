
#!/bin/bash

echo "🔧 Killing processes on ports 5000, 5173, and 6379..."

# Kill by port using fuser - more aggressive
fuser -k 5000/tcp 5173/tcp 6379/tcp 2>/dev/null || true

# Kill processes by name patterns - more comprehensive
pkill -9 -f "tsx.*server/index.ts" 2>/dev/null || true
pkill -9 -f "tsx.*server" 2>/dev/null || true
pkill -9 -f "node.*server" 2>/dev/null || true
pkill -9 -f "node.*5000" 2>/dev/null || true
pkill -9 -f "npm.*dev" 2>/dev/null || true  
pkill -9 -f "vite.*dev" 2>/dev/null || true
pkill -9 -f "PORT=5000" 2>/dev/null || true
pkill -9 -f "rest-express" 2>/dev/null || true

# Give processes time to die
sleep 2

# Verify ports are free
for port in 5000 5173; do
  if fuser ${port}/tcp >/dev/null 2>&1; then
    echo "🔥 Force killing remaining processes on port ${port}..."
    fuser -k ${port}/tcp 2>/dev/null || true
    sleep 1
  fi
done

echo "✅ Port cleanup complete"

# Verify cleanup worked
echo "📊 Port status check:"
for port in 5000 5173; do
  if fuser ${port}/tcp >/dev/null 2>&1; then
    echo "❌ Port ${port} still in use"
  else
    echo "✅ Port ${port} is free"
  fi
done
