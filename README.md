# Gym Timer

Simple exercise timer app: pick exercises, set work/rest times and rounds, then run the workout.

Exercise data comes from [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). Media © Gym visual.

Workout history and weekly KPIs are stored with **FastAPI + SQLite** (`backend/gym_timer.db`).

## Run

### Double-click (Windows)

Double-click `start-gym-timer.bat`  
It starts the API + app and opens `http://localhost:5173`.

### Frontend

```bash
npm install
npm run dev
```

### Backend (history + KPIs)

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Optional frontend env (`VITE_API_URL`, default `http://localhost:8000`).

### Regenerate roast MP3 voices

```bash
pip install -r scripts/requirements-audio.txt
python scripts/generate_roast_audio.py
```

Or double-click `scripts/generate-roast-audio.bat`.  
Files are saved to `public/audio/roasts/01.mp3` … `12.mp3`.

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
