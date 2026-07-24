# Gym Timer

Build a workout, set work/rest timing, and run it with a clear on-screen timer. Optional warm-up and cool-down videos, roast-style voice cues, and local progress tracking.

Exercise data comes from [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). Media © Gym visual.

## Features

- Search an exercise library and build a custom session (series, reps, work/rest defaults)
- Work / rest countdown with skip controls
- Optional upper-body and leg warm-up / cool-down video steps
- Save and load workouts (local presets + API-backed saved workouts)
- Day-of-week preset JSON files under `public/workouts/`
- Progress KPIs and session history (FastAPI + SQLite)
- Custom voice phrases (record or upload) for encouragement / roast cues

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | FastAPI, Uvicorn, Pydantic |
| Storage | SQLite (`backend/gym_timer.db`) |

## Requirements

- [Node.js](https://nodejs.org/) LTS
- Python 3.10+
- (Optional) [ngrok](https://ngrok.com) on `PATH` for a public HTTPS tunnel

No Docker required.

## Quick start

### Configure (once per machine)

```bash
cp .env.example .env   # macOS/Linux
# copy .env.example .env   # Windows
```

Edit `.env` before the first run if you need non-default ports or a tunnel.

| Variable | Purpose | Default |
|---|---|---|
| `API_HOST` / `API_PORT` | FastAPI bind address | `0.0.0.0` / `8000` |
| `VITE_PORT` | Frontend port | `5173` |
| `VITE_API_URL` | Direct API origin (leave empty to use `/api` proxy) | empty |
| `VITE_API_PROXY_TARGET` | Vite `/api` proxy target | `http://127.0.0.1:8000` |
| `NGROK_DOMAIN` | Optional public tunnel hostname (no `https://`) | empty |

### Run API + frontend together

```bash
npm run setup    # creates backend/.venv, installs backend + frontend deps
npm run dev:all  # starts the API and the app (ports from .env)
```

Open `http://localhost:5173` (or your `VITE_PORT`). Press `Ctrl+C` to stop both.

### Windows double-click

Double-click `start-gym-timer.bat`.  
It reads `.env`, starts the API + app, and opens the local URL. A public HTTPS tunnel via ngrok starts only if `ngrok` is on `PATH` **and** `NGROK_DOMAIN` is set in `.env`.

### Frontend only

```bash
npm install
npm run dev
```

### Backend only (history, KPIs, phrases)

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

The frontend talks to the API through the Vite dev proxy (`/api` → `VITE_API_PROXY_TARGET`). Leave `VITE_API_URL` empty unless the frontend should call another API origin directly.

## How it works

1. Set **work**, **rest**, and **rounds**
2. Search the library and add exercises (series / reps)
3. Start — warm-up (optional) → work/rest timer → cool-down (optional)
4. Finished sessions are saved to SQLite when the API is running
5. Open **Progress** for weekly / monthly KPIs and history
6. Open **Sounds** to manage built-in and custom voice phrases

## Privacy and local data

This app is meant for local use. The following stay on your machine and are **gitignored** — do not commit them:

| Path | Contents |
|---|---|
| `.env` | Local ports, optional ngrok domain |
| `backend/gym_timer.db` | Workout history, KPIs, saved workouts, phrase metadata |
| `backend/uploads/` | Custom voice recordings |

Safe to share: source code, `.env.example`, and the preset JSON files under `public/workouts/` (review those if they include personal notes or loads you prefer to keep private).

## Presets

- `public/workouts/lunes-push.json`
- `public/workouts/martes-pull.json`
- `public/workouts/miercoles-legs.json`
- `public/workouts/jueves-push.json`
- `public/workouts/viernes-pull.json`
- `public/workouts/sabado-legs.json`
- `public/workouts/example-workout.json`

## License / credits

- Exercise metadata: [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
- Exercise media © Gym visual
