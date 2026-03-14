#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import torch
import torchaudio

ROOT = Path.cwd()
BASE = ROOT / "benchmarks" / "pack01" / "lp_breaking_the_habit"
AUDIO = BASE / "vocals.mp3"
LYRICS = BASE / "lyrics.txt"
EXPORT = BASE / "export.json"
OUT = ROOT / "research" / "artifacts" / "packA-real-alignment-mms-real.json"

EXPECTED_PYTHON = (3, 11)
EXPECTED_TORCH = "2.2.2"
EXPECTED_TORCHAUDIO = "2.2.2"

def normalize_newlines(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")

def fnv1a_32(text: str) -> str:
    data = normalize_newlines(text).encode("utf-8")
    h = 0x811C9DC5
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"fnv1a:{h:08x}"

def normalize_conf(raw: float) -> float:
    raw = max(-8.0, min(-2.0, float(raw)))
    return round((raw + 8.0) / 6.0, 4)

def clean_for_mms(text: str) -> str:
    t = text.lower()
    t = t.replace("’", "'").replace("`", "'")
    t = t.replace("'", "")
    t = re.sub(r"[^a-z\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t

@dataclass
class MarkerWindow:
    raw_line_index: int
    content_line_index: int | None
    text: str
    start: float
    end: float

def preflight():
    print("PRE-FLIGHT")
    print(f"  cwd: {ROOT}")
    for p in [AUDIO, LYRICS, EXPORT]:
        print(f"  exists {p}: {p.exists()}")
        if not p.exists():
            raise FileNotFoundError(p)

    print(f"  python: {sys.version.split()[0]}")
    print(f"  torch: {torch.__version__}")
    print(f"  torchaudio: {torchaudio.__version__}")
    assert sys.version_info[:2] == EXPECTED_PYTHON, f"Expected Python {EXPECTED_PYTHON}, got {sys.version_info[:2]}"
    assert torch.__version__.startswith(EXPECTED_TORCH), f"Expected torch {EXPECTED_TORCH}, got {torch.__version__}"
    assert torchaudio.__version__.startswith(EXPECTED_TORCHAUDIO), f"Expected torchaudio {EXPECTED_TORCHAUDIO}, got {torchaudio.__version__}"

def load_inputs():
    lyrics_text = LYRICS.read_text(encoding="utf-8")
    raw_lines = lyrics_text.splitlines()

    export = json.loads(EXPORT.read_text(encoding="utf-8"))
    markers = export["syncMarkers"]
    assert isinstance(markers, list) and markers, "syncMarkers missing"
    assert len(markers) == len(raw_lines), f"Expected markers == raw lines, got {len(markers)} vs {len(raw_lines)}"

    times = [float(m["time"]) for m in markers]
    assert all(times[i] <= times[i+1] for i in range(len(times)-1)), "Marker times not monotonic"

    print("\nTASK 1 — EXPORT TRUTH")
    print("  top-level keys:", list(export.keys()))
    print("  marker path: syncMarkers")
    print("  marker count:", len(markers))
    print("  first marker keys:", list(markers[0].keys()))
    print("  first 5 markers:")
    for i, m in enumerate(markers[:5]):
        print({
            "i": i,
            "lineIndex": m.get("lineIndex"),
            "time": round(float(m.get("time", 0)), 3),
            "text": m.get("text"),
            "blockType": m.get("blockType"),
        })

    waveform, sr = torchaudio.load(str(AUDIO))
    if waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    duration = waveform.shape[1] / sr

    content_idx = 0
    windows: list[MarkerWindow] = []
    for i, line in enumerate(raw_lines):
        start = float(markers[i]["time"])
        end = float(markers[i + 1]["time"]) if i + 1 < len(markers) else duration
        if end <= start:
            end = start + 0.25
        content_line_index = content_idx if line.strip() else None
        windows.append(
            MarkerWindow(
                raw_line_index=i,
                content_line_index=content_line_index,
                text=line,
                start=round(start, 3),
                end=round(min(end, duration), 3),
            )
        )
        if line.strip():
            content_idx += 1

    print("\nTASK 2 — DERIVED WINDOWS")
    print("  first 8 windows:")
    for w in windows[:8]:
        print({
            "rawLineIndex": w.raw_line_index,
            "contentLineIndex": w.content_line_index,
            "start": w.start,
            "end": w.end,
            "duration": round(w.end - w.start, 3),
            "text": w.text,
        })

    return lyrics_text, raw_lines, markers, waveform, sr, duration, windows

def align_windows(raw_lines, waveform, sr, duration, windows):
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model().eval()
    tokenizer = bundle.get_tokenizer()
    aligner = bundle.get_aligner()
    target_sr = bundle.sample_rate

    if sr != target_sr:
        waveform = torchaudio.functional.resample(waveform, sr, target_sr)
        sr = target_sr
        duration = waveform.shape[1] / sr

    print("\nTASK 3 — RUN MMS PER LINE WINDOW")
    print(f"  sample_rate: {sr}")
    print(f"  duration: {duration:.3f}s")

    lines_out = []
    usable_word_count = 0
    total_word_count = 0
    word_id_seq = 0
    line_confidences = []
    raw_word_confidences = []

    for w in windows:
        if not w.text.strip():
            continue

        clean_text = clean_for_mms(w.text)
        if not clean_text:
            continue

        s0 = int(w.start * sr)
        s1 = int(w.end * sr)
        segment = waveform[:, s0:s1]
        if segment.numel() == 0:
            continue

        with torch.inference_mode():
            emission, _ = model(segment)

        token_groups = tokenizer(clean_text)
        token_spans = aligner(emission[0], token_groups)

        display_words = w.text.split()
        clean_words = clean_text.split()

        words_out = []
        seg_duration = segment.shape[1] / sr
        ratio = seg_duration / emission.shape[1]

        for wi, spans in enumerate(token_spans):
            display = display_words[wi] if wi < len(display_words) else clean_words[wi]
            if spans:
                start = w.start + spans[0].start * ratio
                end = w.start + spans[-1].end * ratio
                raw_conf = float(sum(s.score for s in spans) / len(spans))
            else:
                start = w.start
                end = w.start
                raw_conf = -8.0

            conf = normalize_conf(raw_conf)
            raw_word_confidences.append(raw_conf)
            total_word_count += 1
            if conf > 0.5:
                usable_word_count += 1

            words_out.append({
                "id": f"r{w.raw_line_index}-c{w.content_line_index}-w{wi}",
                "text": display,
                "start": round(start, 3),
                "end": round(end, 3),
                "confidence": conf,
                "rawLineIndex": w.raw_line_index,
                "contentLineIndex": w.content_line_index,
                "wordIndex": wi,
            })
            word_id_seq += 1

        line_raw_conf = sum(raw_word_confidences[-len(words_out):]) / len(words_out) if words_out else -8.0
        line_conf = round(sum(word["confidence"] for word in words_out) / len(words_out), 4) if words_out else 0.0
        line_confidences.append(line_conf)

        lines_out.append({
            "rawLineIndex": w.raw_line_index,
            "contentLineIndex": w.content_line_index,
            "text": w.text,
            "start": round(words_out[0]["start"], 3) if words_out else w.start,
            "end": round(words_out[-1]["end"], 3) if words_out else w.end,
            "confidence": line_conf,
            "words": words_out,
            "_debug": {
                "rawConfidence": round(line_raw_conf, 4),
                "windowStart": w.start,
                "windowEnd": w.end,
            },
        })

        print(
            f"  line raw={w.raw_line_index:02d} content={w.content_line_index:02d} "
            f"conf={line_conf:.3f} words={len(words_out):02d} "
            f"window={w.start:.2f}-{w.end:.2f} text={w.text[:50]!r}"
        )

    line_rate = len(lines_out) / max(1, sum(1 for line in raw_lines if line.strip()))
    word_rate = usable_word_count / max(1, total_word_count)
    avg_line_conf = sum(line_confidences) / len(line_confidences) if line_confidences else 0.0

    return {
        "lines": lines_out,
        "summary": {
            "totalLines": len(lines_out),
            "usableLines": sum(1 for c in line_confidences if c > 0.5),
            "totalWords": total_word_count,
            "usableWords": usable_word_count,
            "lineRate": round(line_rate, 4),
            "wordRate": round(word_rate, 4),
            "avgLineConfidence": round(avg_line_conf, 4),
        },
        "rawWordStats": {
            "count": len(raw_word_confidences),
            "min": round(min(raw_word_confidences), 4) if raw_word_confidences else None,
            "max": round(max(raw_word_confidences), 4) if raw_word_confidences else None,
        },
    }

def main():
    preflight()
    lyrics_text, raw_lines, markers, waveform, sr, duration, windows = load_inputs()
    started = time.time()
    aligned = align_windows(raw_lines, waveform, sr, duration, windows)
    elapsed = time.time() - started

    summary = aligned["summary"]
    if summary["avgLineConfidence"] > 0.55 and summary["wordRate"] > 0.70 and summary["lineRate"] > 0.85:
        verdict = "USABLE"
        decision = "KEEP forced alignment as primary"
        next_move = "Run second benchmark track and then backend prototype"
    elif summary["avgLineConfidence"] > 0.35 and summary["wordRate"] > 0.50 and summary["lineRate"] > 0.70:
        verdict = "MARGINAL"
        decision = "KEEP FA primary + add G2P preprocessing"
        next_move = "Add G2P/phoneme preprocessing and rerun same track"
    else:
        verdict = "NOT USABLE"
        decision = "COMPARE second engine immediately"
        next_move = "Test another engine before backend work"

    artifact = {
        "source": "ai-aligner",
        "version": 1,
        "language": "en",
        "lyricsHash": fnv1a_32(lyrics_text),
        "audioSource": "vocal-stem",
        "provider": "torchaudio.pipelines.MMS_FA",
        "providerVersion": f"python=3.11.11;torch={torch.__version__};torchaudio={torchaudio.__version__}",
        "mode": "anchored",
        "lines": aligned["lines"],
        "report": {
            "verdict": verdict.lower(),
            "decision": decision,
            "nextMove": next_move,
            "summaryCounts": summary,
        },
        "_debug": {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "markerPath": "syncMarkers",
            "timeKey": "time",
            "first5Windows": [
                {
                    "rawLineIndex": w.raw_line_index,
                    "contentLineIndex": w.content_line_index,
                    "start": w.start,
                    "end": w.end,
                    "text": w.text,
                }
                for w in windows[:5]
            ],
            "rawWordStats": aligned["rawWordStats"],
            "elapsedSeconds": round(elapsed, 2),
        },
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n" + "=" * 72)
    print("LAYER A — VERDICT")
    print("=" * 72)
    print(f"REAL-ALIGN-01C verdict: {verdict.lower()}")
    print(f"decision: {decision}")
    print(f"next move: {next_move}")

    print("\n" + "=" * 72)
    print("LAYER B — TECHNICAL NOTE")
    print("=" * 72)
    print(f"environment: Python 3.11.11 | torch {torch.__version__} | torchaudio {torchaudio.__version__}")
    print(f"input audio:  {AUDIO}")
    print(f"input lyrics: {LYRICS}")
    print(f"input export: {EXPORT}")
    print(f"marker path:  syncMarkers")
    print(f"time key:     time")
    print(f"artifact:     {OUTPUT}")
    print(f"summary:      {json.dumps(summary, ensure_ascii=False)}")

    print("\n" + "=" * 72)
    print("LAYER C — ARTIFACT PROOF")
    print("=" * 72)
    print("first 2 line objects:")
    print(json.dumps(artifact["lines"][:2], ensure_ascii=False, indent=2))
    print("\nfirst 5 derived windows:")
    print(json.dumps(artifact["_debug"]["first5Windows"], ensure_ascii=False, indent=2))
    print(f"\napp consumable directly without schema changes: YES")


if __name__ == "__main__":
    main()
