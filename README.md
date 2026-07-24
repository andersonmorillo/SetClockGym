# Gym Timer

Simple exercise timer app: pick exercises, set work/rest times and rounds, then run the workout.

Exercise data comes from [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). Media © Gym visual.

Workout history and weekly KPIs are stored with **FastAPI + SQLite** (`backend/gym_timer.db`).

## Run

No Docker required — just Node.js (LTS) and Python 3.10+.

### Configure (once per machine)

```bash
cp .env.example .env   # macOS/Linux
# copy .env.example .env   # Windows
```

Edit `.env` before the first run. Important keys:

| Variable | Purpose | Default |
|---|---|---|
| `API_HOST` / `API_PORT` | FastAPI bind address | `0.0.0.0` / `8000` |
| `VITE_PORT` | Frontend port | `5173` |
| `VITE_API_URL` | Direct API origin (leave empty to use `/api` proxy) | empty |
| `VITE_API_PROXY_TARGET` | Vite `/api` proxy target | `http://127.0.0.1:8000` |
| `NGROK_DOMAIN` | Optional public tunnel hostname (no `https://`) | empty |

### Any OS (Windows, macOS, Linux)

```bash
npm run setup    # creates backend/.venv, installs backend + frontend deps
npm run dev:all  # starts the API and the app together (ports from .env)
```

Open `http://localhost:5173` (or your `VITE_PORT`). Press `Ctrl+C` to stop both.

### Double-click (Windows, alternative)

Double-click `start-gym-timer.bat`.  
It reads `.env`, starts the API + app, and opens the local URL. A public HTTPS tunnel via [ngrok](https://ngrok.com) starts only if `ngrok` is on `PATH` **and** `NGROK_DOMAIN` is set in `.env`.

### Frontend only

```bash
npm install
npm run dev
```

### Backend only (history + KPIs)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The frontend talks to the API through the Vite dev proxy (`/api` → `VITE_API_PROXY_TARGET`), so leave `VITE_API_URL` empty unless you want the frontend to call another API origin directly.

## How it works

1. Set **work**, **rest**, and **rounds**
2. Search the library and add exercises (set series/reps)
3. Start — warm-up → work/rest timer → cool-down
4. Finished sessions are saved to SQLite
5. Open **Progress KPIs** for weekly improvement metrics

## Presets

- `public/workouts/lunes-push.json`
- `public/workouts/martes-pull.json`
- `public/workouts/miercoles-legs.json`
- `public/workouts/jueves-push.json`
- `public/workouts/viernes-pull.json`
- `public/workouts/sabado-legs.json`
