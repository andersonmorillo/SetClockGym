#!/usr/bin/env bash
# Menu launcher: local API + Vite, then a Chromium app window.
# ponytail: Chromium --app, not Electron. Switch if this must run with no browser installed.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"

pidfile="$root/logs/desktop.pid"
state="$root/logs/desktop.env"
log="$root/logs/desktop.log"
profile="${XDG_DATA_HOME:-$HOME/.local/share}/gym-timer/chromium"

notify() {
  command -v notify-send >/dev/null 2>&1 && notify-send -a "Gym Timer" "Gym Timer" "$1" || true
}

load_env() {
  local file="$root/.env" line key value
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "$line" != *=* ]] && continue
    key="${line%%=*}"
    key="${key%"${key##*[![:space:]]}"}"
    [[ -z "$key" || -n "${!key+x}" ]] && continue
    value="${line#*=}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" == \"*\" || "$value" == \'*\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    printf -v "$key" '%s' "$value"
    export "$key"
  done <"$file"
}

port_busy() {
  ss -ltnH "sport = :$1" | grep -q .
}

free_port() {
  local p="$1"
  while port_busy "$p"; do
    p=$((p + 1))
    ((p <= 65535)) || { echo "No free port from $1" >&2; exit 1; }
  done
  printf '%s\n' "$p"
}

browser() {
  command -v chromium || command -v google-chrome || command -v brave
}

install_desktop() {
  local apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  local icon_dir="${XDG_DATA_HOME:-$HOME/.local/share}/icons/hicolor/256x256/apps"
  local icon="$icon_dir/gym-timer.png"
  mkdir -p "$apps" "$icon_dir"
  if command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 256 -h 256 "$root/desktop/gym-timer.svg" -o "$icon"
  else
    icon="$root/desktop/gym-timer.svg"
  fi
  cat >"$apps/gym-timer.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Gym Timer
Comment=Workout timer
Exec=$root/start-gym-timer.sh
Icon=$icon
Terminal=false
Categories=Utility;
Keywords=Gym;Workout;Timer;
StartupNotify=true
StartupWMClass=GymTimer
Actions=Stop;

[Desktop Action Stop]
Name=Stop Gym Timer
Exec=$root/start-gym-timer.sh stop
EOF
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$apps" || true
}

running() {
  [[ -f "$pidfile" ]] && kill -0 "$(<"$pidfile")" 2>/dev/null
}

ensure_setup() {
  if [[ -x "$root/backend/.venv/bin/python" && -d "$root/node_modules" ]] \
    && "$root/backend/.venv/bin/python" -c "import fastapi,uvicorn" >/dev/null 2>&1; then
    return 0
  fi
  notify "First launch: installing dependencies"
  npm run setup >>"$log" 2>&1 || {
    notify "Setup failed. See logs/desktop.log"
    exit 1
  }
}

start_servers() {
  mkdir -p "$root/logs"
  ensure_setup
  [[ -f "$root/.env" ]] || cp "$root/.env.example" "$root/.env"
  load_env
  local api_port vite_port
  api_port="$(free_port "${API_PORT:-8000}")"
  vite_port="$(free_port "${VITE_PORT:-5173}")"
  export API_PORT="$api_port" VITE_PORT="$vite_port"
  export VITE_API_PROXY_TARGET="http://127.0.0.1:$api_port"
  printf 'API_PORT=%s\nVITE_PORT=%s\n' "$api_port" "$vite_port" >"$state"
  setsid node scripts/dev.mjs all >>"$log" 2>&1 </dev/null &
  echo $! >"$pidfile"
  local i
  for i in $(seq 1 90); do
    if curl -sf -o /dev/null "http://127.0.0.1:$vite_port/"; then
      return 0
    fi
    if ! running; then
      notify "Gym Timer failed to start. See logs/desktop.log"
      exit 1
    fi
    sleep 0.5
  done
  notify "Gym Timer timed out. See logs/desktop.log"
  exit 1
}

open_window() {
  local bin url
  bin="$(browser)" || {
    notify "Install Chromium to open Gym Timer"
    exit 1
  }
  # shellcheck disable=SC1090
  source "$state"
  url="http://127.0.0.1:${VITE_PORT}"
  "$bin" \
    --app="$url" \
    --class=GymTimer \
    --user-data-dir="$profile" \
    --no-first-run \
    --no-default-browser-check \
    --disable-extensions \
    --window-size=1100,800 \
    >/dev/null 2>&1 &
}

stop_servers() {
  if [[ -f "$pidfile" ]]; then
    local pid
    pid="$(<"$pidfile")"
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    rm -f "$pidfile"
  fi
  if [[ -n "${profile:-}" ]]; then
    pkill -f "user-data-dir=${profile}" 2>/dev/null || true
  fi
}

self_check() {
  local hold holder picked
  hold="$(free_port 39000)"
  python3 -c 'import socket,sys,time; s=socket.create_server(("127.0.0.1", int(sys.argv[1]))); time.sleep(3)' "$hold" &
  holder=$!
  sleep 0.2
  port_busy "$hold" || { echo "failed to hold $hold"; kill "$holder" 2>/dev/null || true; exit 1; }
  picked="$(free_port "$hold")"
  kill "$holder" 2>/dev/null || true
  wait "$holder" 2>/dev/null || true
  [[ "$picked" -gt "$hold" ]] || { echo "free_port returned $picked"; exit 1; }
  port_busy "$picked" && { echo "picked busy port $picked"; exit 1; }
  echo "ok $picked"
}

cmd="${1:-open}"
case "$cmd" in
  open)
    mkdir -p "$root/logs"
    exec 9>"$root/logs/desktop.lock"
    flock 9
    install_desktop
    running || start_servers
    open_window
    ;;
  stop) stop_servers ;;
  install) install_desktop ;;
  self-check) self_check ;;
  *)
    echo "Usage: $0 [open|stop|install|self-check]" >&2
    exit 1
    ;;
esac
