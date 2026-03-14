#!/usr/bin/env python3

"""
mms-workbench-01 runner

Current phase:
- benchmark/preset contract bootstrap
- JSON loading + minimal validation
- marker source parsing (`markers ?? syncMarkers`)
- lyrics loading
- preset-aware marker-window plan
- no alignment execution yet

Modes:
- single
- matrix
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

import torch
import torchaudio


MIN_WINDOW_SEC = 1.8


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="MMS workbench runner (preset-aware window planning phase)"
    )

    sub = parser.add_subparsers(dest="mode", required=True)

    single = sub.add_parser("single", help="Run one benchmark with one preset")
    single.add_argument("--benchmark", required=True, help="Path to benchmark manifest JSON")
    single.add_argument("--preset", required=True, help="Path to preset JSON")

    matrix = sub.add_parser("matrix", help="Run one benchmark against many presets")
    matrix.add_argument("--benchmark", required=True, help="Path to benchmark manifest JSON")
    matrix.add_argument("--presets-glob", required=True, help="Glob for preset JSON files")

    return parser


def ensure_exists(path_str: str, kind: str) -> Path:
    path = Path(path_str)
    if not path.exists():
        raise SystemExit(f"{kind} not found: {path}")
    return path


def load_json(path: Path, kind: str) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"failed to parse {kind}: {path} ({exc})") from exc
    if not isinstance(data, dict):
        raise SystemExit(f"{kind} must be a JSON object: {path}")
    return data


def validate_benchmark(data: dict[str, Any], path: Path) -> None:
    required = [
        "id",
        "title",
        "language",
        "audio_file",
        "lyrics_file",
        "marker_source_file",
        "marker_field_candidates",
        "audio_source",
        "trusted_lyrics_source",
        "expected_line_count",
    ]
    missing = [key for key in required if key not in data]
    if missing:
        raise SystemExit(f"benchmark missing keys {missing}: {path}")

    if not isinstance(data["marker_field_candidates"], list) or not data["marker_field_candidates"]:
        raise SystemExit(f"benchmark marker_field_candidates invalid: {path}")

    for key in ("audio_file", "lyrics_file", "marker_source_file"):
        target = Path(data[key])
        if not target.exists():
            raise SystemExit(f"benchmark referenced file missing: {target} (from {path})")


def validate_preset(data: dict[str, Any], path: Path) -> None:
    required = [
        "id",
        "language",
        "mode",
        "text_mode",
        "padding_ms",
        "short_window_policy",
        "tail_grace_ms",
        "nonlexical_mode",
        "confidence_norm_profile",
    ]
    missing = [key for key in required if key not in data]
    if missing:
        raise SystemExit(f"preset missing keys {missing}: {path}")

    padding = data.get("padding_ms")
    if not isinstance(padding, dict):
        raise SystemExit(f"preset padding_ms must be object: {path}")

    for key in ("pre", "post"):
        if key not in padding:
            raise SystemExit(f"preset padding_ms missing '{key}': {path}")
        if not isinstance(padding[key], int):
            raise SystemExit(f"preset padding_ms.{key} must be int: {path}")


def extract_markers(marker_doc: dict[str, Any], field_candidates: list[str], path: Path) -> tuple[str, list[dict[str, Any]]]:
    for field in field_candidates:
        value = marker_doc.get(field)
        if isinstance(value, list):
            return field, value
    raise SystemExit(
        f"marker source has none of the expected fields {field_candidates}: {path}"
    )


def validate_markers(markers: list[dict[str, Any]], path: Path) -> None:
    if not markers:
        raise SystemExit(f"marker source contains empty marker list: {path}")

    for idx, marker in enumerate(markers):
        if not isinstance(marker, dict):
            raise SystemExit(f"marker #{idx} is not an object: {path}")
        if "lineIndex" not in marker:
            raise SystemExit(f"marker #{idx} missing lineIndex: {path}")
        if "time" not in marker:
            raise SystemExit(f"marker #{idx} missing time: {path}")
        if not isinstance(marker["lineIndex"], int):
            raise SystemExit(f"marker #{idx} lineIndex must be int: {path}")
        if not isinstance(marker["time"], (int, float)):
            raise SystemExit(f"marker #{idx} time must be number: {path}")


def normalize_line_endings(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def load_lyrics_lines(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    normalized = normalize_line_endings(text)
    return normalized.split("\n")


def load_waveform(path: Path) -> tuple[torch.Tensor, int]:
    waveform, sr = torchaudio.load(str(path))
    if waveform.dim() == 2 and waveform.shape[0] > 1:
        waveform = waveform.mean(dim=0, keepdim=True)
    return waveform, sr


def summarize_benchmark(data: dict[str, Any], path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "id": data["id"],
        "title": data["title"],
        "language": data["language"],
        "audio_file": data["audio_file"],
        "lyrics_file": data["lyrics_file"],
        "marker_source_file": data["marker_source_file"],
        "marker_field_candidates": data["marker_field_candidates"],
        "audio_source": data["audio_source"],
        "trusted_lyrics_source": data["trusted_lyrics_source"],
        "expected_line_count": data["expected_line_count"],
    }


def summarize_preset(data: dict[str, Any], path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "id": data["id"],
        "language": data["language"],
        "mode": data["mode"],
        "text_mode": data["text_mode"],
        "padding_ms": data["padding_ms"],
        "short_window_policy": data["short_window_policy"],
        "tail_grace_ms": data["tail_grace_ms"],
        "nonlexical_mode": data["nonlexical_mode"],
        "confidence_norm_profile": data["confidence_norm_profile"],
    }


def summarize_marker_source(
    marker_doc: dict[str, Any],
    marker_source_path: Path,
    field_used: str,
    markers: list[dict[str, Any]],
) -> dict[str, Any]:
    first = markers[0] if markers else None
    last = markers[-1] if markers else None
    return {
        "path": str(marker_source_path),
        "title": marker_doc.get("title"),
        "field_used": field_used,
        "markers_count": len(markers),
        "first_marker": {
            "lineIndex": first.get("lineIndex") if first else None,
            "time": first.get("time") if first else None,
            "text": first.get("text") if first else None,
        },
        "last_marker": {
            "lineIndex": last.get("lineIndex") if last else None,
            "time": last.get("time") if last else None,
            "text": last.get("text") if last else None,
        },
    }


def load_and_validate_marker_source(benchmark: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    marker_source_path = Path(benchmark["marker_source_file"])
    marker_doc = load_json(marker_source_path, "marker source")
    field_used, markers = extract_markers(
        marker_doc,
        benchmark["marker_field_candidates"],
        marker_source_path,
    )
    validate_markers(markers, marker_source_path)
    summary = summarize_marker_source(marker_doc, marker_source_path, field_used, markers)
    return summary, markers


def build_window_plan(lines: list[str], markers: list[dict[str, Any]], preset: dict[str, Any]) -> list[dict[str, Any]]:
    sorted_markers = sorted(markers, key=lambda m: m["time"])
    windows: list[dict[str, Any]] = []

    pre_pad_sec = preset["padding_ms"]["pre"] / 1000.0
    post_pad_sec = preset["padding_ms"]["post"] / 1000.0
    short_policy = preset["short_window_policy"]

    for i, marker in enumerate(sorted_markers):
        marker_start = float(marker["time"])
        marker_end = float(sorted_markers[i + 1]["time"]) if i + 1 < len(sorted_markers) else None
        raw_line_index = int(marker["lineIndex"])
        text = lines[raw_line_index] if 0 <= raw_line_index < len(lines) else ""

        base_duration = (marker_end - marker_start) if marker_end is not None else None
        short_window = base_duration is not None and base_duration < MIN_WINDOW_SEC

        padded_start = max(0.0, marker_start - pre_pad_sec)
        padded_end = (marker_end + post_pad_sec) if marker_end is not None else None

        policy_action = "keep"
        effective_start = padded_start
        effective_end = padded_end

        if short_window and marker_end is not None:
            if short_policy == "skip":
                policy_action = "skip"
            elif short_policy == "extend":
                policy_action = "extend"
                current_duration = padded_end - padded_start
                if current_duration < MIN_WINDOW_SEC:
                    effective_end = padded_start + MIN_WINDOW_SEC

        effective_duration = (
            (effective_end - effective_start)
            if effective_end is not None
            else None
        )

        windows.append({
            "rawLineIndex": raw_line_index,
            "text": text,
            "markerStart": marker_start,
            "markerEnd": marker_end,
            "baseDuration": base_duration,
            "paddedStart": padded_start,
            "paddedEnd": padded_end,
            "effectiveStart": effective_start,
            "effectiveEnd": effective_end,
            "effectiveDuration": effective_duration,
            "shortWindow": short_window,
            "policyAction": policy_action,
        })

    return windows


def summarize_window_plan(lines: list[str], windows: list[dict[str, Any]], preset: dict[str, Any]) -> dict[str, Any]:
    short_count = sum(1 for w in windows if w["shortWindow"])
    skipped_count = sum(1 for w in windows if w["policyAction"] == "skip")
    extended_count = sum(1 for w in windows if w["policyAction"] == "extend")

    return {
        "lines_total": len(lines),
        "windows_total": len(windows),
        "preset_id": preset["id"],
        "padding_ms": preset["padding_ms"],
        "short_window_policy": preset["short_window_policy"],
        "short_windows": short_count,
        "skipped_windows": skipped_count,
        "extended_windows": extended_count,
        "first_windows": windows[:5],
        "last_windows": windows[-3:],
    }


def clean_text(text: str) -> str:
    stripped = text.strip()
    lowered = stripped.lower()
    no_parens = re.sub(r"[\(\)\[\]\{\}]", " ", lowered)
    no_punct = re.sub(r"[^\w\s\-'\"]", " ", no_parens, flags=re.UNICODE)
    collapsed = re.sub(r"\s+", " ", no_punct).strip()
    return collapsed


def phoneticish_transform(text: str, language: str) -> str:
    cleaned = clean_text(text)
    if language != "ru":
        return cleaned

    out = cleaned
    replacements = [
        ("ё", "yo"),
        ("ж", "zh"),
        ("х", "kh"),
        ("ц", "ts"),
        ("ч", "ch"),
        ("ш", "sh"),
        ("щ", "shch"),
        ("ю", "yu"),
        ("я", "ya"),
        ("й", "y"),
        ("ъ", ""),
        ("ь", ""),
    ]
    single = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
        "з": "z", "и": "i", "к": "k", "л": "l", "м": "m", "н": "n",
        "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "ы": "y", "э": "e"
    }

    for src, dst in replacements:
        out = out.replace(src, dst)

    chars = []
    for ch in out:
        chars.append(single.get(ch, ch))
    out = "".join(chars)
    out = re.sub(r"\s+", " ", out).strip()
    return out


def prepare_text(original_text: str, preset: dict[str, Any], language: str) -> dict[str, Any]:
    text_mode = preset["text_mode"]

    if text_mode == "baseline":
        cleaned = original_text.strip()
        engine_input = cleaned
    elif text_mode == "clean-text":
        cleaned = clean_text(original_text)
        engine_input = cleaned
    elif text_mode == "phoneticish":
        cleaned = clean_text(original_text)
        engine_input = phoneticish_transform(original_text, language)
    else:
        raise SystemExit(f"unsupported text_mode: {text_mode}")

    return {
        "original": original_text,
        "cleaned": cleaned,
        "engineInput": engine_input,
        "isEmptyAfterPrep": len(engine_input.strip()) == 0,
    }


def build_text_plan(
    lines: list[str],
    windows: list[dict[str, Any]],
    preset: dict[str, Any],
    language: str,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    nonlexical_mode = preset["nonlexical_mode"]

    for window in windows:
        raw_line_index = window["rawLineIndex"]
        original_text = lines[raw_line_index] if 0 <= raw_line_index < len(lines) else ""
        text_prep = prepare_text(original_text, preset, language)

        stripped = original_text.strip()
        is_nonlexical = bool(
            re.fullmatch(r"[\W_]*([A-Za-zА-Яа-яЁё]+[-\s]?){2,}[\W_]*", stripped)
        ) and "-" in stripped

        action = "align"

        if text_prep["isEmptyAfterPrep"]:
            action = "skip-empty"
        elif is_nonlexical and nonlexical_mode == "line-only":
            action = "line-only"
        elif is_nonlexical and nonlexical_mode == "skip":
            action = "skip-nonlexical"

        items.append({
            "rawLineIndex": raw_line_index,
            "text": text_prep["original"],
            "cleanedText": text_prep["cleaned"],
            "engineInputText": text_prep["engineInput"],
            "isEmptyAfterPrep": text_prep["isEmptyAfterPrep"],
            "isNonLexical": is_nonlexical,
            "action": action,
        })

    return items


def summarize_text_plan(items: list[dict[str, Any]], preset: dict[str, Any]) -> dict[str, Any]:
    empty_count = sum(1 for item in items if item["isEmptyAfterPrep"])
    nonlexical_count = sum(1 for item in items if item["isNonLexical"])
    skipped_count = sum(1 for item in items if item["action"].startswith("skip"))
    line_only_count = sum(1 for item in items if item["action"] == "line-only")

    return {
        "preset_id": preset["id"],
        "text_mode": preset["text_mode"],
        "nonlexical_mode": preset["nonlexical_mode"],
        "items_total": len(items),
        "empty_after_prep": empty_count,
        "nonlexical_count": nonlexical_count,
        "skipped_items": skipped_count,
        "line_only_items": line_only_count,
        "first_items": items[:5],
    }


def align_single_window(
    window: dict[str, Any],
    text_item: dict[str, Any],
    waveform: torch.Tensor,
    sr: int,
) -> dict[str, Any]:
    if window["effectiveEnd"] is None:
        raise SystemExit("cannot probe last open-ended window yet")

    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model().eval()
    tokenizer = bundle.get_tokenizer()
    aligner = bundle.get_aligner()

    target_sr = bundle.sample_rate
    audio = waveform
    if sr != target_sr:
        audio = torchaudio.functional.resample(audio, sr, target_sr)

    start_sec = float(window["effectiveStart"])
    end_sec = float(window["effectiveEnd"])

    start_frame = max(0, int(start_sec * target_sr))
    end_frame = min(audio.shape[1], int(end_sec * target_sr))

    if end_frame <= start_frame:
        raise SystemExit("invalid probe window after frame conversion")

    segment = audio[:, start_frame:end_frame]
    if segment.numel() == 0:
        raise SystemExit("empty audio segment for probe window")

    transcript = text_item["engineInputText"].strip()
    if not transcript:
        raise SystemExit("empty engine input text for probe window")

    if segment.dim() == 1:
        segment = segment.unsqueeze(0)
    elif segment.dim() == 2 and segment.shape[0] > 1:
        segment = segment.mean(dim=0, keepdim=True)
    elif segment.dim() != 2:
        raise SystemExit(f"unexpected segment rank: {tuple(segment.shape)}")

    print("DEBUG segment shape:", tuple(segment.shape), flush=True)
    print("DEBUG segment duration sec:", segment.shape[-1] / target_sr, flush=True)

    with torch.inference_mode():
        emission, _ = model(segment)

    clean_words_list = transcript.split()
    token_groups = tokenizer(clean_words_list)
    token_spans = aligner(emission[0], token_groups)

    ratio = segment.shape[1] / emission.shape[1] / target_sr

    original_text = text_item["text"]
    display_words = original_text.strip().split()

    words = []
    raw_confs = []

    for wi, spans in enumerate(token_spans):
        display = display_words[wi] if wi < len(display_words) else (
            clean_words_list[wi] if wi < len(clean_words_list) else ""
        )

        if spans:
            word_start = round(start_sec + spans[0].start * ratio, 3)
            word_end = round(start_sec + spans[-1].end * ratio, 3)
            raw_conf = float(sum(s.score for s in spans) / len(spans))
        else:
            word_start = start_sec
            word_end = start_sec
            raw_conf = -8.0

        norm_conf = round(
            max(0.0, min(1.0, (max(-8.0, min(-2.0, raw_conf)) + 8.0) / 6.0)),
            4,
        )
        raw_confs.append(raw_conf)

        words.append({
            "text": display,
            "start": word_start,
            "end": word_end,
            "confidence": norm_conf,
            "wordIndex": wi,
        })

    avg_conf = round(
        sum(w["confidence"] for w in words) / len(words),
        4,
    ) if words else 0.0

    return {
        "rawLineIndex": window["rawLineIndex"],
        "originalText": original_text,
        "engineInputText": transcript,
        "effectiveStart": start_sec,
        "effectiveEnd": end_sec,
        "audioFrames": int(segment.shape[1]),
        "emissionFrames": int(emission.shape[1]),
        "timeRatioSecPerFrame": ratio,
        "words": words,
        "avgConfidence": avg_conf,
        "_debug": {
            "rawConfs": [round(c, 4) for c in raw_confs],
            "tokenCount": len(token_spans),
        },
    }


def run_all_windows(
    windows: list[dict[str, Any]],
    text_plan: list[dict[str, Any]],
    waveform: torch.Tensor,
    sr: int,
    audio_duration_sec: float,
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []

    for window, text_item in zip(windows, text_plan):
        if text_item["action"] != "align":
            results.append({
                "rawLineIndex": window["rawLineIndex"],
                "text": text_item["text"],
                "engineInputText": text_item["engineInputText"],
                "status": text_item["action"],
                "probe": None,
            })
            continue

        if text_item["isEmptyAfterPrep"]:
            results.append({
                "rawLineIndex": window["rawLineIndex"],
                "text": text_item["text"],
                "engineInputText": text_item["engineInputText"],
                "status": "skip-empty",
                "probe": None,
            })
            continue

        execution_window = dict(window)
        if execution_window["effectiveEnd"] is None:
            execution_window["effectiveEnd"] = audio_duration_sec

        probe_summary = align_single_window(
            execution_window,
            text_item,
            waveform,
            sr,
        )

        results.append({
            "rawLineIndex": window["rawLineIndex"],
            "text": text_item["text"],
            "engineInputText": text_item["engineInputText"],
            "status": "aligned-probe",
            "probe": probe_summary,
        })

    return results


def build_alignment_output(
    benchmark: dict[str, Any],
    preset: dict[str, Any],
    text_plan: list[dict[str, Any]],
    execution_results: list[dict[str, Any]],
) -> dict[str, Any]:
    line_entries = []

    text_by_raw = {item["rawLineIndex"]: item for item in text_plan}

    for result in execution_results:
        raw_line_index = result["rawLineIndex"]
        text_item = text_by_raw.get(raw_line_index)

        if text_item is None:
            continue

        probe = result["probe"]

        if result["status"] == "aligned-probe" and probe is not None:
            line_entries.append({
                "rawLineIndex": raw_line_index,
                "text": text_item["text"],
                "start": probe["effectiveStart"],
                "end": probe["effectiveEnd"],
                "confidence": probe.get("avgConfidence"),
                "words": probe.get("words", []),
            })
        else:
            line_entries.append({
                "rawLineIndex": raw_line_index,
                "text": text_item["text"],
                "start": None,
                "end": None,
                "confidence": None,
                "words": [],
            })

    return {
        "source": "ai-aligner",
        "version": 1,
        "provider": "mms-workbench",
        "providerVersion": "seed-v1",
        "mode": preset["mode"],
        "language": benchmark["language"],
        "audioSource": benchmark["audio_source"],
        "lines": line_entries,
    }


def run_single(benchmark_path: Path, preset_path: Path) -> None:
    benchmark = load_json(benchmark_path, "benchmark")
    preset = load_json(preset_path, "preset")

    validate_benchmark(benchmark, benchmark_path)
    validate_preset(preset, preset_path)

    marker_summary, markers = load_and_validate_marker_source(benchmark)
    lines = load_lyrics_lines(Path(benchmark["lyrics_file"]))
    waveform, sr = load_waveform(Path(benchmark["audio_file"]))
    windows = build_window_plan(lines, markers, preset)
    window_summary = summarize_window_plan(lines, windows, preset)
    text_plan = build_text_plan(lines, windows, preset, benchmark["language"])
    text_summary = summarize_text_plan(text_plan, preset)

    execution_results = run_all_windows(
        windows,
        text_plan,
        waveform,
        sr,
        float(duration),
    )

    execution_summary = {
        "total_items": len(execution_results),
        "aligned_probe_items": sum(1 for item in execution_results if item["status"] == "aligned-probe"),
        "skipped_items": sum(1 for item in execution_results if item["status"].startswith("skip")),
        "first_results": execution_results[:5],
    }

    alignment_output = build_alignment_output(
        benchmark,
        preset,
        text_plan,
        execution_results,
    )

    output_dir = Path("research/mms-workbench-01/outputs") / f'{benchmark["id"]}__{preset["id"]}'
    output_dir.mkdir(parents=True, exist_ok=True)
    alignment_path = output_dir / "alignment.json"
    alignment_path.write_text(
        json.dumps(alignment_output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print("VALIDATION OK")
    print("mode=single")
    print("benchmark_summary=")
    print(json.dumps(summarize_benchmark(benchmark, benchmark_path), ensure_ascii=False, indent=2))
    print("marker_source_summary=")
    print(json.dumps(marker_summary, ensure_ascii=False, indent=2))
    print("window_plan_summary=")
    print(json.dumps(window_summary, ensure_ascii=False, indent=2))
    print("text_plan_summary=")
    print(json.dumps(text_summary, ensure_ascii=False, indent=2))
    print("execution_summary=")
    print(json.dumps(execution_summary, ensure_ascii=False, indent=2))
    print("alignment_output_path=")
    print(str(alignment_path))
    print("preset_summary=")
    print(json.dumps(summarize_preset(preset, preset_path), ensure_ascii=False, indent=2))


def run_matrix(benchmark_path: Path, presets_glob: str) -> None:
    benchmark = load_json(benchmark_path, "benchmark")
    validate_benchmark(benchmark, benchmark_path)

    marker_summary, markers = load_and_validate_marker_source(benchmark)
    lines = load_lyrics_lines(Path(benchmark["lyrics_file"]))

    preset_paths = sorted(Path().glob(presets_glob))
    if not preset_paths:
        raise SystemExit(f"no presets matched: {presets_glob}")

    preset_summaries = []
    window_summaries = []
    text_summaries = []
    for preset_path in preset_paths:
        preset = load_json(preset_path, "preset")
        validate_preset(preset, preset_path)
        preset_summaries.append(summarize_preset(preset, preset_path))

        windows = build_window_plan(lines, markers, preset)
        window_summary = summarize_window_plan(lines, windows, preset)
        window_summaries.append(window_summary)
        text_plan = build_text_plan(lines, windows, preset, benchmark["language"])
        text_summary = summarize_text_plan(text_plan, preset)
        text_summaries.append(text_summary)

    print("VALIDATION OK")
    print("mode=matrix")
    print("benchmark_summary=")
    print(json.dumps(summarize_benchmark(benchmark, benchmark_path), ensure_ascii=False, indent=2))
    print("marker_source_summary=")
    print(json.dumps(marker_summary, ensure_ascii=False, indent=2))
    print("window_plan_summaries=")
    print(json.dumps(window_summaries, ensure_ascii=False, indent=2))
    print("text_plan_summaries=")
    print(json.dumps(text_summaries, ensure_ascii=False, indent=2))
    print("matched_presets=")
    print(json.dumps(preset_summaries, ensure_ascii=False, indent=2))


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    benchmark_path = ensure_exists(args.benchmark, "benchmark")

    if args.mode == "single":
        preset_path = ensure_exists(args.preset, "preset")
        run_single(benchmark_path, preset_path)
        return

    if args.mode == "matrix":
        run_matrix(benchmark_path, args.presets_glob)
        return

    raise SystemExit(f"unsupported mode: {args.mode}")


if __name__ == "__main__":
    main()
