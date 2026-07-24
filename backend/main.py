from __future__ import annotations

import json
import re
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).resolve().parent / "gym_timer.db"
WORKOUTS_DIR = Path(__file__).resolve().parents[1] / "public" / "workouts"
PHRASES_DIR = Path(__file__).resolve().parent / "uploads" / "phrases"
ALLOWED_AUDIO_EXT = {".mp3", ".wav", ".ogg", ".m4a", ".webm"}
SEED_FILES = [
    "lunes-push.json",
    "martes-pull.json",
    "miercoles-legs.json",
    "jueves-push.json",
    "viernes-pull.json",
    "sabado-legs.json",
]
PLANNED_SESSIONS_PER_WEEK = 6

app = FastAPI(title="Gym Timer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def ensure_column(conn: sqlite3.Connection, table: str, column: str, ddl: str) -> None:
    cols = {
        row["name"]
        for row in conn.execute(f"PRAGMA table_info({table})").fetchall()
    }
    if column not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")


def init_db() -> None:
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS workout_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                workout_name TEXT NOT NULL,
                exercise_count INTEGER NOT NULL,
                rounds INTEGER NOT NULL,
                total_series INTEGER NOT NULL,
                elapsed_seconds INTEGER NOT NULL,
                exercises_json TEXT NOT NULL,
                feedback_json TEXT
            )
            """
        )
        ensure_column(
            conn, "workout_sessions", "feedback_json", "feedback_json TEXT"
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS saved_workouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                settings_json TEXT NOT NULL,
                exercises_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS phrases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phrase TEXT NOT NULL,
                filename TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
    PHRASES_DIR.mkdir(parents=True, exist_ok=True)
    seed_default_workouts()


def seed_default_workouts() -> None:
    with connect() as conn:
        count = conn.execute("SELECT COUNT(*) AS c FROM saved_workouts").fetchone()[
            "c"
        ]
        if count > 0:
            return

        for filename in SEED_FILES:
            path = WORKOUTS_DIR / filename
            if not path.exists():
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            name = str(data.get("name") or path.stem)
            settings = data.get("settings") or {}
            exercises = data.get("exercises") or []
            conn.execute(
                """
                INSERT OR IGNORE INTO saved_workouts (
                    name, settings_json, exercises_json, updated_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    name,
                    json.dumps(settings),
                    json.dumps(exercises),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
        conn.commit()


class WorkoutSaveIn(BaseModel):
    name: str
    settings: dict[str, Any]
    exercises: list[dict[str, Any]] = Field(default_factory=list)


class SavedWorkoutOut(BaseModel):
    id: int
    name: str
    settings: dict[str, Any]
    exercises: list[dict[str, Any]]
    updated_at: str


def row_to_saved_workout(row: sqlite3.Row) -> SavedWorkoutOut:
    return SavedWorkoutOut(
        id=row["id"],
        name=row["name"],
        settings=json.loads(row["settings_json"] or "{}"),
        exercises=json.loads(row["exercises_json"] or "[]"),
        updated_at=row["updated_at"],
    )


class SessionCreate(BaseModel):
    workout_name: str
    exercise_count: int = Field(ge=0)
    rounds: int = Field(ge=1)
    total_series: int = Field(ge=0)
    elapsed_seconds: int = Field(ge=0)
    exercises: list[dict[str, Any]] = Field(default_factory=list)
    feedback: dict[str, Any] | None = None
    created_at: str | None = None


class SessionOut(BaseModel):
    id: int
    created_at: str
    workout_name: str
    exercise_count: int
    rounds: int
    total_series: int
    elapsed_seconds: int
    exercises: list[dict[str, Any]]
    feedback: dict[str, Any] | None = None


def parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def week_start(dt: datetime) -> datetime:
    local = dt.astimezone(timezone.utc)
    monday = local - timedelta(days=local.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def month_start(dt: datetime) -> datetime:
    local = dt.astimezone(timezone.utc)
    return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def next_month_start(dt: datetime) -> datetime:
    start = month_start(dt)
    if start.month == 12:
        return start.replace(year=start.year + 1, month=1)
    return start.replace(month=start.month + 1)


def previous_month_start(dt: datetime) -> datetime:
    start = month_start(dt)
    if start.month == 1:
        return start.replace(year=start.year - 1, month=12)
    return start.replace(month=start.month - 1)


def planned_sessions_for_month(start: datetime) -> int:
    days = (next_month_start(start) - start).days
    return max(1, round(days * PLANNED_SESSIONS_PER_WEEK / 7))


def classify_workout(name: str) -> str:
    lower = name.lower()
    if (
        "push" in lower
        or "lunes" in lower
        or "jueves" in lower
        or "día 1" in lower
        or "dia 1" in lower
    ):
        return "push"
    if "pull" in lower or "martes" in lower or "viernes" in lower:
        return "pull"
    if (
        "leg" in lower
        or "pierna" in lower
        or "miércoles" in lower
        or "miercoles" in lower
        or "sábado" in lower
        or "sabado" in lower
    ):
        return "legs"
    return "other"


def row_to_session(row: sqlite3.Row) -> SessionOut:
    keys = set(row.keys())
    feedback_raw = row["feedback_json"] if "feedback_json" in keys else None
    feedback = json.loads(feedback_raw) if feedback_raw else None
    return SessionOut(
        id=row["id"],
        created_at=row["created_at"],
        workout_name=row["workout_name"],
        exercise_count=row["exercise_count"],
        rounds=row["rounds"],
        total_series=row["total_series"],
        elapsed_seconds=row["elapsed_seconds"],
        exercises=json.loads(row["exercises_json"] or "[]"),
        feedback=feedback,
    )


def pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None if current == 0 else 100.0
    return round(((current - previous) / previous) * 100, 1)


def aggregate_verdicts(
    sessions: list[SessionOut], key: str
) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    for session in sessions:
        feedback = session.feedback or {}
        for item in feedback.get(key) or []:
            name = str(item.get("name") or "exercise")
            counts[name] = counts.get(name, 0) + 1
    return [
        {"name": name, "count": count}
        for name, count in sorted(
            counts.items(), key=lambda pair: (-pair[1], pair[0])
        )[:8]
    ]


def compute_period_stats(
    sessions: list[SessionOut], planned_sessions: int
) -> dict[str, Any]:
    total_seconds = sum(s.elapsed_seconds for s in sessions)
    total_series = sum(s.total_series for s in sessions)
    mix = {"push": 0, "pull": 0, "legs": 0, "other": 0}
    for session in sessions:
        mix[classify_workout(session.workout_name)] += 1

    best_reps: dict[str, int] = {}
    best_hang_seconds = 0
    for session in sessions:
        for item in session.exercises:
            name = str(item.get("name") or item.get("exercise_name") or "exercise")
            reps = int(item.get("reps") or 0)
            work_seconds = int(item.get("work_seconds") or 0)
            label = str(item.get("reps_label") or "").lower()
            if "hang" in name.lower() or "30-45" in label or "s" == label[-1:]:
                best_hang_seconds = max(best_hang_seconds, work_seconds)
            if reps > 0:
                best_reps[name] = max(best_reps.get(name, 0), reps)

    with_feedback = [s for s in sessions if s.feedback]
    completion_values = [
        float(s.feedback.get("series_completion_pct") or 0)
        for s in with_feedback
        if isinstance(s.feedback, dict)
    ]
    pause_count = sum(
        int((s.feedback or {}).get("pause_count") or 0) for s in with_feedback
    )
    skip_series_count = sum(
        int((s.feedback or {}).get("skip_series_count") or 0) for s in with_feedback
    )
    skip_exercise_count = sum(
        int((s.feedback or {}).get("skip_exercise_count") or 0) for s in with_feedback
    )
    skip_rest_count = sum(
        int((s.feedback or {}).get("skip_rest_count") or 0) for s in with_feedback
    )
    rest_compliance_values = [
        float(s.feedback.get("rest_compliance_pct"))
        for s in with_feedback
        if isinstance(s.feedback, dict)
        and s.feedback.get("rest_compliance_pct") is not None
    ]
    session_rpe_values = [
        float(s.feedback.get("session_rpe"))
        for s in with_feedback
        if isinstance(s.feedback, dict) and s.feedback.get("session_rpe") is not None
    ]
    training_load_values = [
        float(s.feedback.get("training_load"))
        for s in with_feedback
        if isinstance(s.feedback, dict) and s.feedback.get("training_load") is not None
    ]

    count = len(sessions)
    planned = max(1, planned_sessions)
    return {
        "sessions": count,
        "total_seconds": total_seconds,
        "total_minutes": round(total_seconds / 60, 1),
        "total_series": total_series,
        "avg_session_seconds": int(total_seconds / count) if count else 0,
        "avg_session_minutes": round((total_seconds / count) / 60, 1) if count else 0,
        "adherence_pct": round((count / planned) * 100, 1),
        "series_completion_pct": (
            round(sum(completion_values) / len(completion_values), 1)
            if completion_values
            else None
        ),
        "pause_count": pause_count,
        "skip_series_count": skip_series_count,
        "skip_exercise_count": skip_exercise_count,
        "skip_rest_count": skip_rest_count,
        "rest_compliance_pct": (
            round(sum(rest_compliance_values) / len(rest_compliance_values), 1)
            if rest_compliance_values
            else None
        ),
        "avg_session_rpe": (
            round(sum(session_rpe_values) / len(session_rpe_values), 1)
            if session_rpe_values
            else None
        ),
        "avg_training_load": (
            round(sum(training_load_values) / len(training_load_values), 1)
            if training_load_values
            else None
        ),
        "strengths": aggregate_verdicts(with_feedback, "strengths"),
        "weaknesses": aggregate_verdicts(with_feedback, "weaknesses"),
        "workout_mix": mix,
        "best_reps": best_reps,
        "best_hang_seconds": best_hang_seconds,
    }


def compute_week_stats(sessions: list[SessionOut]) -> dict[str, Any]:
    return compute_period_stats(sessions, PLANNED_SESSIONS_PER_WEEK)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


class PhraseOut(BaseModel):
    id: int
    phrase: str
    audio_url: str
    created_at: str


def row_to_phrase(row: sqlite3.Row) -> PhraseOut:
    return PhraseOut(
        id=row["id"],
        phrase=row["phrase"],
        audio_url=f"/api/phrases/audio/{row['filename']}",
        created_at=row["created_at"],
    )


def safe_audio_filename(original_name: str | None) -> str:
    suffix = Path(original_name or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXT:
        raise HTTPException(
            status_code=400,
            detail="Audio must be mp3, wav, ogg, m4a, or webm",
        )
    return f"{uuid.uuid4().hex}{suffix}"


@app.get("/api/phrases", response_model=list[PhraseOut])
def list_phrases() -> list[PhraseOut]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM phrases
            ORDER BY datetime(created_at) DESC, id DESC
            """
        ).fetchall()
    return [row_to_phrase(row) for row in rows]


@app.post("/api/phrases", response_model=PhraseOut)
async def create_phrase(
    phrase: str = Form(...),
    audio: UploadFile = File(...),
) -> PhraseOut:
    text = phrase.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Phrase is required")

    filename = safe_audio_filename(audio.filename)
    PHRASES_DIR.mkdir(parents=True, exist_ok=True)
    destination = PHRASES_DIR / filename
    content = await audio.read()
    if not content:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    destination.write_bytes(content)

    created_at = datetime.now(timezone.utc).isoformat()
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO phrases (phrase, filename, created_at)
            VALUES (?, ?, ?)
            """,
            (text, filename, created_at),
        )
        phrase_id = cursor.lastrowid
        conn.commit()
        row = conn.execute(
            "SELECT * FROM phrases WHERE id = ?",
            (phrase_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to save phrase")
    return row_to_phrase(row)


@app.get("/api/phrases/audio/{filename}")
def get_phrase_audio(filename: str) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9]{32}\.[a-z0-9]+", filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = PHRASES_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(path)


@app.delete("/api/phrases/{phrase_id}")
def delete_phrase(phrase_id: int) -> dict[str, bool]:
    with connect() as conn:
        row = conn.execute(
            "SELECT filename FROM phrases WHERE id = ?",
            (phrase_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Phrase not found")
        conn.execute("DELETE FROM phrases WHERE id = ?", (phrase_id,))
        conn.commit()
    audio_path = PHRASES_DIR / str(row["filename"])
    if audio_path.is_file():
        audio_path.unlink()
    return {"ok": True}


@app.get("/api/workouts", response_model=list[SavedWorkoutOut])
def list_workouts() -> list[SavedWorkoutOut]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM saved_workouts
            ORDER BY name COLLATE NOCASE ASC
            """
        ).fetchall()
    return [row_to_saved_workout(row) for row in rows]


@app.get("/api/workouts/{workout_id}", response_model=SavedWorkoutOut)
def get_workout(workout_id: int) -> SavedWorkoutOut:
    with connect() as conn:
        row = conn.execute(
            "SELECT * FROM saved_workouts WHERE id = ?",
            (workout_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    return row_to_saved_workout(row)


@app.post("/api/workouts", response_model=SavedWorkoutOut)
def upsert_workout(payload: WorkoutSaveIn) -> SavedWorkoutOut:
    name = payload.name.strip() or "My workout"
    updated_at = datetime.now(timezone.utc).isoformat()
    with connect() as conn:
        existing = conn.execute(
            "SELECT id FROM saved_workouts WHERE name = ?",
            (name,),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE saved_workouts
                SET settings_json = ?, exercises_json = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    json.dumps(payload.settings),
                    json.dumps(payload.exercises),
                    updated_at,
                    existing["id"],
                ),
            )
            workout_id = existing["id"]
        else:
            cursor = conn.execute(
                """
                INSERT INTO saved_workouts (
                    name, settings_json, exercises_json, updated_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    name,
                    json.dumps(payload.settings),
                    json.dumps(payload.exercises),
                    updated_at,
                ),
            )
            workout_id = cursor.lastrowid
        conn.commit()
        row = conn.execute(
            "SELECT * FROM saved_workouts WHERE id = ?",
            (workout_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to save workout")
    return row_to_saved_workout(row)


@app.delete("/api/workouts/{workout_id}")
def delete_workout(workout_id: int) -> dict[str, bool]:
    with connect() as conn:
        cursor = conn.execute(
            "DELETE FROM saved_workouts WHERE id = ?",
            (workout_id,),
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    return {"ok": True}


@app.get("/api/history", response_model=list[SessionOut])
def list_history(limit: int = 50) -> list[SessionOut]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM workout_sessions
            ORDER BY datetime(created_at) DESC
            LIMIT ?
            """,
            (max(1, min(limit, 200)),),
        ).fetchall()
    return [row_to_session(row) for row in rows]


@app.post("/api/history", response_model=SessionOut)
def create_history(payload: SessionCreate) -> SessionOut:
    created_at = payload.created_at or datetime.now(timezone.utc).isoformat()
    feedback_json = json.dumps(payload.feedback) if payload.feedback else None
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO workout_sessions (
                created_at, workout_name, exercise_count, rounds,
                total_series, elapsed_seconds, exercises_json, feedback_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                payload.workout_name.strip() or "Workout",
                payload.exercise_count,
                payload.rounds,
                payload.total_series,
                payload.elapsed_seconds,
                json.dumps(payload.exercises),
                feedback_json,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM workout_sessions WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to save session")
    return row_to_session(row)


@app.delete("/api/history/{session_id}")
def delete_history(session_id: int) -> dict[str, bool]:
    with connect() as conn:
        cursor = conn.execute(
            "DELETE FROM workout_sessions WHERE id = ?",
            (session_id,),
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}


@app.get("/api/kpis/weekly")
def weekly_kpis() -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM workout_sessions
            ORDER BY datetime(created_at) ASC
            """
        ).fetchall()

    sessions = [row_to_session(row) for row in rows]
    now = datetime.now(timezone.utc)
    this_start = week_start(now)
    last_start = this_start - timedelta(days=7)
    next_start = this_start + timedelta(days=7)

    this_week = [
        s
        for s in sessions
        if this_start <= parse_dt(s.created_at) < next_start
    ]
    last_week = [
        s
        for s in sessions
        if last_start <= parse_dt(s.created_at) < this_start
    ]

    this_stats = compute_week_stats(this_week)
    last_stats = compute_week_stats(last_week)

    # Streak: consecutive ISO weeks with >= planned sessions, counting back from current/last active week.
    streak = 0
    cursor = this_start
    if this_stats["sessions"] == 0:
        cursor = last_start
    while True:
        week_end = cursor + timedelta(days=7)
        count = sum(
            1
            for s in sessions
            if cursor <= parse_dt(s.created_at) < week_end
        )
        if count >= PLANNED_SESSIONS_PER_WEEK:
            streak += 1
            cursor -= timedelta(days=7)
            continue
        break

    return {
        "planned_sessions_per_week": PLANNED_SESSIONS_PER_WEEK,
        "week_start": this_start.date().isoformat(),
        "this_week": this_stats,
        "last_week": last_stats,
        "deltas": {
            "sessions_pct": pct_change(
                this_stats["sessions"], last_stats["sessions"]
            ),
            "minutes_pct": pct_change(
                this_stats["total_minutes"], last_stats["total_minutes"]
            ),
            "series_pct": pct_change(
                this_stats["total_series"], last_stats["total_series"]
            ),
        },
        "streak_weeks": streak,
        "recent_sessions": [
            row_to_session(row).model_dump()
            for row in reversed(rows[-12:])
        ] if rows else [],
    }


@app.get("/api/kpis/monthly")
def monthly_kpis() -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT * FROM workout_sessions
            ORDER BY datetime(created_at) ASC
            """
        ).fetchall()

    sessions = [row_to_session(row) for row in rows]
    now = datetime.now(timezone.utc)
    this_start = month_start(now)
    last_start = previous_month_start(now)
    next_start = next_month_start(now)
    planned_this = planned_sessions_for_month(this_start)
    planned_last = planned_sessions_for_month(last_start)

    this_month = [
        s
        for s in sessions
        if this_start <= parse_dt(s.created_at) < next_start
    ]
    last_month = [
        s
        for s in sessions
        if last_start <= parse_dt(s.created_at) < this_start
    ]

    this_stats = compute_period_stats(this_month, planned_this)
    last_stats = compute_period_stats(last_month, planned_last)

    streak = 0
    cursor = this_start
    if this_stats["sessions"] == 0:
        cursor = last_start
    while True:
        period_end = next_month_start(cursor)
        planned = planned_sessions_for_month(cursor)
        count = sum(
            1
            for s in sessions
            if cursor <= parse_dt(s.created_at) < period_end
        )
        if count >= planned:
            streak += 1
            cursor = previous_month_start(cursor)
            continue
        break

    return {
        "planned_sessions_per_month": planned_this,
        "month_start": this_start.date().isoformat(),
        "this_month": this_stats,
        "last_month": last_stats,
        "deltas": {
            "sessions_pct": pct_change(
                this_stats["sessions"], last_stats["sessions"]
            ),
            "minutes_pct": pct_change(
                this_stats["total_minutes"], last_stats["total_minutes"]
            ),
            "series_pct": pct_change(
                this_stats["total_series"], last_stats["total_series"]
            ),
        },
        "streak_months": streak,
        "recent_sessions": [
            row_to_session(row).model_dump()
            for row in reversed(rows[-12:])
        ]
        if rows
        else [],
    }


init_db()
