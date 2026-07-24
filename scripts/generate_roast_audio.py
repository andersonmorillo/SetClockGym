"""
Generate MP3 roast phrases with Microsoft Edge TTS (edge-tts).

Usage:
  pip install -r scripts/requirements-audio.txt
  python scripts/generate_roast_audio.py
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts

# Keep in sync with src/data/encouragements.ts
ROASTS = [
    "Get fit because she rejected you.",
    "They said you couldn't. Prove them wrong.",
    "Your future self is watching. Don't disappoint them.",
    "Sweat now. Flex later.",
    "One more round. Excuses don't build muscle.",
    "Heartbreak burns calories. Use it.",
    "Be the reason your clothes fit better.",
    "Nobody is coming to save you. Start the timer.",
    "Train like you have something to prove.",
    "Pain is temporary. Skipping today lasts longer.",
    "You vs you. Win today.",
    "Make them ask what you've been doing.",
]

# Natural English voice; change if you prefer another edge-tts voice.
VOICE = "en-US-GuyNeural"
OUT_DIR = Path(__file__).resolve().parents[1] / "public" / "audio" / "roasts"


async def generate_one(index: int, text: str, retries: int = 3) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_file = OUT_DIR / f"{index:02d}.mp3"
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            communicate = edge_tts.Communicate(text=text, voice=VOICE)
            await communicate.save(str(out_file))
            return out_file
        except Exception as exc:  # noqa: BLE001 - retry network/API failures
            last_error = exc
            print(f"Retry {attempt}/{retries} for {out_file.name}: {exc}")
            await asyncio.sleep(1.5 * attempt)
    raise RuntimeError(f"Failed to generate {out_file.name}") from last_error


async def main() -> None:
    print(f"Voice: {VOICE}")
    print(f"Output: {OUT_DIR}")
    for i, text in enumerate(ROASTS, start=1):
        path = await generate_one(i, text)
        print(f"Saved {path.name}: {text}")
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
