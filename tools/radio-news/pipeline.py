"""Six Star News: briefing do dia -> roteiros (Claude Haiku) -> áudio (Kokoro-82M) -> MP3 + manifesto.

Roda na GitHub Action `radio-news.yml`. Localmente:
    pip install -r tools/radio-news/requirements.txt   (+ ffmpeg e espeak-ng instalados)
    python tools/radio-news/pipeline.py --briefing tools/radio-news/fixtures/briefing.json --out out

Variáveis: APP_URL, RADIO_PIPELINE_TOKEN (para baixar o briefing), ANTHROPIC_API_KEY, R2_PUBLIC_URL.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.request

import numpy as np
import soundfile as sf

HERE = pathlib.Path(__file__).parent
CACHE = pathlib.Path.home() / ".cache" / "kokoro"
MODEL_URLS = {
    "kokoro.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
    "voices.bin": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
}
SR = 24000
MODEL = os.environ.get("RADIO_MODEL", "claude-haiku-5-5")
CFG = json.loads((HERE / "stations.json").read_text(encoding="utf-8"))
STATIONS = CFG["stations"]
AD_VOICE = CFG["ad"]
BANNED = re.compile(r"\b(leak|leaked|vazad|spoiler)\b", re.I)


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def ensure_model() -> tuple[pathlib.Path, pathlib.Path]:
    CACHE.mkdir(parents=True, exist_ok=True)
    for name, url in MODEL_URLS.items():
        p = CACHE / name
        if not p.exists():
            log(f"baixando {name}…")
            urllib.request.urlretrieve(url, p)
    return CACHE / "kokoro.onnx", CACHE / "voices.bin"


def load_briefing(args) -> dict:
    if args.briefing:
        return json.loads(pathlib.Path(args.briefing).read_text(encoding="utf-8"))
    date = args.date or dt.date.today().isoformat()
    req = urllib.request.Request(
        f"{os.environ['APP_URL']}/internal/radio/briefing/{date}",
        headers={"Authorization": f"Bearer {os.environ['RADIO_PIPELINE_TOKEN']}", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def safe_items(briefing: dict) -> list[dict]:
    """Segunda barreira (a primeira é o Laravel): nada com spoiler, leak ou não verificado entra no prompt."""
    ok = []
    for it in briefing.get("items", []):
        if it.get("spoiler_type") or it.get("reliability") in (None, "nao-verificado"):
            continue
        ok.append({k: it.get(k) for k in ("headline_en", "summary_en", "reliability", "region", "kind")})
    return ok


def write_scripts(items: list[dict], date: str) -> dict:
    import anthropic

    prompt = (HERE / "prompt.md").read_text(encoding="utf-8")
    client = anthropic.Anthropic()
    msg = client.messages.create(
        model=MODEL,
        max_tokens=6000,
        system=prompt,
        messages=[{
            "role": "user",
            "content": json.dumps({"date": date, "stations": STATIONS, "items": items}, ensure_ascii=False),
        }],
    )
    text = "".join(b.text for b in msg.content if b.type == "text")
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    validate(data)
    return data


def validate(data: dict) -> None:
    for st, bulletins in data.items():
        if st not in STATIONS:
            raise ValueError(f"estação desconhecida: {st}")
        for b in bulletins:
            for seg in b["segments"]:
                if seg["voice"] not in STATIONS[st]["voices"] and seg["voice"] != "ad":
                    raise ValueError(f"voz inválida em {st}: {seg['voice']}")
                if BANNED.search(seg["text"]) or len(seg["text"]) > 400:
                    raise ValueError(f"trecho recusado em {st}: {seg['text'][:60]}")


def tone(f: float, kind: str, dur: float) -> np.ndarray:
    t = np.arange(int(SR * dur)) / SR
    ph = (t * f) % 1
    w = {"saw": 2 * ph - 1, "sq": np.sign(np.sin(2 * np.pi * f * t)) * 0.6,
         "tri": 4 * np.abs(ph - 0.5) - 1, "sin": np.sin(2 * np.pi * f * t)}[kind]
    return w * np.minimum(1, t / 0.02) * np.exp(-t * 6) * 0.18


def sting(st: str, reverse: bool = False) -> np.ndarray:
    f, kind = STATIONS[st]["sting"]
    out = np.zeros(int(SR * 0.9))
    for i, semi in enumerate([7, 4, 0] if reverse else [0, 4, 7]):
        s = tone(f * 2 ** (semi / 12), kind, 0.5)
        o = int(i * 0.12 * SR)
        out[o:o + len(s)] += s
    return out


def render(scripts: dict, date: str, out: pathlib.Path) -> dict:
    from kokoro_onnx import Kokoro

    model, voices = ensure_model()
    k = Kokoro(str(model), str(voices))
    out.mkdir(parents=True, exist_ok=True)
    base = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
    manifest = {"date": date, "model": MODEL, "tts": "kokoro-82m-v1.0", "bulletins": []}
    for st, bulletins in scripts.items():
        for n, b in enumerate(bulletins, 1):
            parts = [sting(st), np.zeros(int(SR * 0.25))]
            for seg in b["segments"]:
                voice, speed = STATIONS[st]["voices"].get(seg["voice"]) or AD_VOICE
                audio, _ = k.create(seg["text"], voice=voice, speed=speed,
                                    lang="en-gb" if voice.startswith("b") else "en-us")
                parts += [audio, np.zeros(int(SR * 0.38))]
            parts.append(sting(st, reverse=True))
            audio = np.concatenate(parts).astype(np.float32)
            name = f"{date}/{st}-{n}.mp3"
            wav = out / f"{st}-{n}.wav"
            sf.write(wav, audio, SR)
            (out / date).mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                            "-af", "highpass=f=70,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5",
                            "-ac", "1", "-b:a", "64k", str(out / name)], check=True)
            wav.unlink()
            manifest["bulletins"].append({
                "station": st, "slot": n, "title": b["title"], "url": f"{base}/radio/news/{name}",
                "duration": round(len(audio) / SR, 1), "transcript": b["segments"],
            })
            log(st, n, manifest["bulletins"][-1]["duration"], "s")
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default="")
    ap.add_argument("--briefing", help="arquivo local em vez de baixar do portal")
    ap.add_argument("--scripts", help="roteiros prontos (pula a IA)")
    ap.add_argument("--out", default="out")
    args = ap.parse_args()
    date = args.date or dt.date.today().isoformat()
    if args.scripts:
        scripts = json.loads(pathlib.Path(args.scripts).read_text(encoding="utf-8"))
        validate(scripts)
    else:
        items = safe_items(load_briefing(args))
        if not items:
            log("briefing vazio: nada a gerar")
            return
        scripts = write_scripts(items, date)
    render(scripts, date, pathlib.Path(args.out))


if __name__ == "__main__":
    main()
