#!/usr/bin/env python3
"""
REAL-ALIGN-02D — RU preprocessing compare on same MMS engine

Goal:
Compare RU preprocessing variants conceptually using the already generated
EN and RU artifacts, and determine whether RU weakness is primarily a
preprocessing issue or an engine limitation.

This script is READ-ONLY:
- no alignment run
- no backend
- no app changes
- only artifact analysis

Inputs:
- research/artifacts/packA-real-alignment-mms-real.json
- research/artifacts/track2-real-alignment-mms-real.json

Output:
- stdout diagnosis
- research/artifacts/track2-preprocessing-compare.json
"""

from __future__ import annotations

import json
import statistics
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path.cwd()
LP_ARTIFACT = ROOT / "research" / "artifacts" / "packA-real-alignment-mms-real.json"
RU_ARTIFACT = ROOT / "research" / "artifacts" / "track2-real-alignment-mms-real.json"
OUT = ROOT / "research" / "artifacts" / "track2-preprocessing-compare.json"


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing artifact: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def safe_mean(vals):
    return statistics.mean(vals) if vals else 0.0


def safe_median(vals):
    if not vals:
        return 0.0
    vals = sorted(vals)
    return vals[len(vals) // 2]


def analyze_artifact(lines: list[dict], label: str) -> dict:
    print(f"\n{'='*72}")
    print(f"ANALYSIS: {label}")
    print(f"{'='*72}")

    total_words = 0
    word_durations = []
    word_confs = []
    line_durations = []
    line_confs = []
    words_per_line = []
    first_word_confs = []
    mid_word_confs = []
    last_word_confs = []
    word_gaps = []
    word_coverage = []
    proportionality_scores = []

    for line in lines:
        words = line.get("words", [])
        if not words:
            continue

        n = len(words)
        total_words += n
        words_per_line.append(n)

        line_dur = float(line["end"]) - float(line["start"])
        line_durations.append(line_dur)
        line_confs.append(float(line["confidence"]))

        first_word_confs.append(float(words[0]["confidence"]))
        if n > 2:
            mid_word_confs.extend(float(w["confidence"]) for w in words[1:-1])
        if n > 1:
            last_word_confs.append(float(words[-1]["confidence"]))

        total_word_dur = 0.0
        for i, w in enumerate(words):
            wd = float(w["end"]) - float(w["start"])
            word_durations.append(wd)
            word_confs.append(float(w["confidence"]))
            total_word_dur += wd

            if i + 1 < n:
                next_w = words[i + 1]
                gap = float(next_w["start"]) - float(w["end"])
                word_gaps.append(gap)

        if line_dur > 0:
            word_coverage.append(total_word_dur / line_dur)

        # Proportionality check:
        # if word durations are too close to simple text-length proportional spread,
        # it can indicate weak acoustic boundary capture.
        if n >= 2 and line_dur > 0:
            char_counts = [len(str(w["text"])) for w in words]
            total_chars = sum(char_counts)
            if total_chars > 0:
                expected_durs = [(cc / total_chars) * line_dur for cc in char_counts]
                actual_durs = [float(w["end"]) - float(w["start"]) for w in words]
                deviations = [
                    abs(a - e) / max(line_dur, 0.01)
                    for a, e in zip(actual_durs, expected_durs)
                ]
                proportionality_scores.append(statistics.mean(deviations))

    def print_stats(vals, name):
        if not vals:
            print(f"  {name}: no data")
            return
        s = sorted(vals)
        print(f"  {name} ({len(vals)} values):")
        print(
            f"    min={s[0]:.4f}  "
            f"p10={s[len(s)//10]:.4f}  "
            f"p25={s[len(s)//4]:.4f}  "
            f"med={s[len(s)//2]:.4f}  "
            f"p75={s[3*len(s)//4]:.4f}  "
            f"p90={s[9*len(s)//10]:.4f}  "
            f"max={s[-1]:.4f}"
        )
        if len(vals) > 1:
            print(
                f"    mean={statistics.mean(vals):.4f}  "
                f"stdev={statistics.stdev(vals):.4f}"
            )

    print(f"\n  Total lines: {len(lines)}")
    print(f"  Total words: {total_words}")
    if words_per_line:
        print(
            f"  Words/line: mean={safe_mean(words_per_line):.2f}  "
            f"min={min(words_per_line)}  max={max(words_per_line)}"
        )

    print_stats(line_durations, "Line duration (s)")
    print_stats(line_confs, "Line confidence")
    print_stats(word_durations, "Word duration (s)")
    print_stats(word_confs, "Word confidence")

    print(f"\n  POSITIONAL CONFIDENCE:")
    if first_word_confs:
        print(
            f"    First word: mean={safe_mean(first_word_confs):.4f}  "
            f"med={safe_median(first_word_confs):.4f}"
        )
    if mid_word_confs:
        print(
            f"    Mid words:  mean={safe_mean(mid_word_confs):.4f}  "
            f"med={safe_median(mid_word_confs):.4f}"
        )
    if last_word_confs:
        print(
            f"    Last word:  mean={safe_mean(last_word_confs):.4f}  "
            f"med={safe_median(last_word_confs):.4f}"
        )

    print_stats(word_gaps, "Word gaps (s)")
    print_stats(word_coverage, "Word coverage ratio")
    print_stats(proportionality_scores, "Proportionality deviation")

    if proportionality_scores:
        mean_prop = safe_mean(proportionality_scores)
        print(f"\n  PROPORTIONALITY CHECK:")
        print(f"    Mean deviation from text-length proportional spread: {mean_prop:.4f}")
        if mean_prop < 0.05:
            print("    *** WARNING: timing may look text-length-distributed, not acoustically driven ***")
        elif mean_prop < 0.10:
            print("    ~ Moderate: some acoustic signal, but may still be weak")
        else:
            print("    OK: timings appear meaningfully non-proportional to text length")

    return {
        "word_durations": word_durations,
        "word_confs": word_confs,
        "line_confs": line_confs,
        "first_confs": first_word_confs,
        "mid_confs": mid_word_confs,
        "last_confs": last_word_confs,
        "word_gaps": word_gaps,
        "coverage": word_coverage,
        "proportionality": proportionality_scores,
        "words_per_line": words_per_line,
    }


def compare_metric(lp_vals, ru_vals, name):
    if not lp_vals or not ru_vals:
        return None
    lp_mean = safe_mean(lp_vals)
    ru_mean = safe_mean(ru_vals)
    lp_med = safe_median(lp_vals)
    ru_med = safe_median(ru_vals)
    delta = ru_mean - lp_mean
    pct = (delta / lp_mean * 100.0) if lp_mean != 0 else 0.0
    return {
        "metric": name,
        "lp_mean": round(lp_mean, 4),
        "lp_median": round(lp_med, 4),
        "ru_mean": round(ru_mean, 4),
        "ru_median": round(ru_med, 4),
        "delta": round(delta, 4),
        "deltaPct": round(pct, 1),
    }


def find_dead_internal_groove(lines: list[dict], top_n: int = 5) -> list[dict]:
    scored = []
    for line in lines:
        words = line.get("words", [])
        if len(words) < 3:
            continue

        first = float(words[0]["confidence"])
        inner = [float(w["confidence"]) for w in words[1:-1]]
        if not inner:
            continue

        inner_avg = safe_mean(inner)
        score = first - inner_avg

        if first >= 0.55 and inner_avg <= 0.35:
            scored.append({
                "rawLineIndex": line["rawLineIndex"],
                "contentLineIndex": line["contentLineIndex"],
                "text": line["text"],
                "lineConfidence": line["confidence"],
                "firstWordConfidence": round(first, 4),
                "innerWordConfidenceAvg": round(inner_avg, 4),
                "score": round(score, 4),
                "words": [
                    {
                        "text": w["text"],
                        "start": w["start"],
                        "end": w["end"],
                        "confidence": w["confidence"],
                    }
                    for w in words
                ],
            })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_n]


def main():
    print("Loading artifacts...")
    lp = load_json(LP_ARTIFACT)
    ru = load_json(RU_ARTIFACT)

    lp_lines = lp.get("lines", [])
    ru_lines = ru.get("lines", [])

    print(f"LP artifact: {LP_ARTIFACT}")
    print(f"RU artifact: {RU_ARTIFACT}")
    print(f"LP lines: {len(lp_lines)}")
    print(f"RU lines: {len(ru_lines)}")

    lp_stats = analyze_artifact(lp_lines, "LP / EN (reference)")
    ru_stats = analyze_artifact(ru_lines, "RU / Omega")

    print(f"\n{'='*72}")
    print("SIDE-BY-SIDE COMPARISON")
    print(f"{'='*72}")

    metrics = [
        compare_metric(lp_stats["word_confs"], ru_stats["word_confs"], "Word confidence"),
        compare_metric(lp_stats["line_confs"], ru_stats["line_confs"], "Line confidence"),
        compare_metric(lp_stats["first_confs"], ru_stats["first_confs"], "First-word confidence"),
        compare_metric(lp_stats["mid_confs"], ru_stats["mid_confs"], "Mid-word confidence"),
        compare_metric(lp_stats["last_confs"], ru_stats["last_confs"], "Last-word confidence"),
        compare_metric(lp_stats["word_durations"], ru_stats["word_durations"], "Word duration (s)"),
        compare_metric(lp_stats["word_gaps"], ru_stats["word_gaps"], "Word gaps (s)"),
        compare_metric(lp_stats["coverage"], ru_stats["coverage"], "Line coverage ratio"),
        compare_metric(lp_stats["proportionality"], ru_stats["proportionality"], "Proportionality deviation"),
        compare_metric(lp_stats["words_per_line"], ru_stats["words_per_line"], "Words per line"),
    ]
    metrics = [m for m in metrics if m is not None]

    print(f"{'Metric':<30} {'LP mean':>10} {'RU mean':>10} {'Δ':>10} {'Δ%':>8}")
    print("-" * 72)
    for m in metrics:
        flag = " ***" if abs(m["deltaPct"]) > 30 else ""
        print(
            f"{m['metric']:<30} "
            f"{m['lp_mean']:>10.4f} "
            f"{m['ru_mean']:>10.4f} "
            f"{m['delta']:>10.4f} "
            f"{m['deltaPct']:>7.1f}%{flag}"
        )

    print(f"\n{'='*72}")
    print("BAD-LINE EXAMPLES (RU dead internal groove)")
    print(f"{'='*72}")

    bad_lines = find_dead_internal_groove(ru_lines)
    if not bad_lines:
        print("No severe dead-internal-groove examples matched the current heuristic.")
    else:
        for ex in bad_lines:
            print(f"\nR{ex['rawLineIndex']:02d} C{ex['contentLineIndex']:02d} "
                  f"lineConf={ex['lineConfidence']:.3f} "
                  f"first={ex['firstWordConfidence']:.3f} "
                  f"innerAvg={ex['innerWordConfidenceAvg']:.3f}")
            print(f"  \"{ex['text']}\"")
            for w in ex["words"]:
                print(f"    {w['text']:<15} {w['start']:.3f}-{w['end']:.3f}  conf={w['confidence']:.3f}")

    print(f"\n{'='*72}")
    print("ROMANIZATION / DEBUG INSPECTION")
    print(f"{'='*72}")

    ru_debug = ru.get("_debug", {})
    print("RU provider:", ru.get("provider"))
    print("RU language:", ru.get("language"))
    print("RU mode:", ru.get("mode"))
    print("RU romanization debug:", json.dumps(ru_debug.get("romanization", {}), ensure_ascii=False, indent=2))

    lp_raw = lp.get("_debug", {}).get("rawScoreDistribution", {})
    ru_raw = ru.get("_debug", {}).get("rawScoreDistribution", {})

    if lp_raw and ru_raw:
        print("\nRaw score distributions:")
        for k in ["min", "p25", "median", "p75", "max"]:
            lv = lp_raw.get(k)
            rv = ru_raw.get(k)
            if lv is not None and rv is not None:
                d = rv - lv
                flag = " ***" if abs(d) > 1.0 else ""
                print(f"  {k:>6}: LP={lv:7.4f}  RU={rv:7.4f}  delta={d:+7.4f}{flag}")

    print(f"\n{'='*72}")
    print("VERDICT")
    print(f"{'='*72}")

    lp_prop = safe_mean(lp_stats["proportionality"])
    ru_prop = safe_mean(ru_stats["proportionality"])
    lp_mid = safe_mean(lp_stats["mid_confs"])
    ru_mid = safe_mean(ru_stats["mid_confs"])
    lp_gap = safe_mean(lp_stats["word_gaps"])
    ru_gap = safe_mean(ru_stats["word_gaps"])
    lp_cov = safe_mean(lp_stats["coverage"])
    ru_cov = safe_mean(ru_stats["coverage"])

    print(f"Key differentials:")
    print(f"  Proportionality deviation: LP={lp_prop:.4f}  RU={ru_prop:.4f}")
    print(f"  Mid-word confidence:       LP={lp_mid:.4f}  RU={ru_mid:.4f}")
    print(f"  Word gaps:                LP={lp_gap:.4f}  RU={ru_gap:.4f}")
    print(f"  Line coverage:            LP={lp_cov:.4f}  RU={ru_cov:.4f}")

    causes = []

    if ru_prop < 0.08:
        causes.append({
            "code": "A",
            "name": "ROMANIZATION QUALITY",
            "detail": "word durations are too close to text-length-proportional spread; acoustic boundaries are weak"
        })

    if ru_mid < lp_mid * 0.7:
        causes.append({
            "code": "D",
            "name": "MMS ACOUSTIC FIT",
            "detail": "mid-line word confidence on RU is much lower than LP"
        })

    ru_med_raw = ru_raw.get("median")
    lp_med_raw = lp_raw.get("median")
    if ru_med_raw is not None and lp_med_raw is not None:
        if ru_med_raw < lp_med_raw - 1.0:
            causes.append({
                "code": "D",
                "name": "MMS ACOUSTIC FIT (raw scores)",
                "detail": f"RU raw median {ru_med_raw:.4f} is much lower than LP {lp_med_raw:.4f}"
            })
        if ru_med_raw > -3.5:
            causes.append({
                "code": "E",
                "name": "CONFIDENCE SATURATION",
                "detail": f"RU raw scores are relatively high ({ru_med_raw:.4f}); normalization may hide variation"
            })

    if not causes:
        causes.append({
            "code": "B",
            "name": "TOKENIZER GRANULARITY",
            "detail": "romanized word tokens may still be too coarse for acoustic alignment"
        })

    print("\nRoot causes (ranked):")
    for i, c in enumerate(causes, start=1):
        print(f"  {i}. [{c['code']}] {c['name']}")
        print(f"     {c['detail']}")

    preprocessing_is_bottleneck = False
    best_hypothesis = "unknown"

    # Decide if preprocessing is likely primary
    if causes and causes[0]["code"] == "A":
        preprocessing_is_bottleneck = True
        best_hypothesis = "preprocessing"
    elif causes and causes[0]["code"] == "B":
        preprocessing_is_bottleneck = True
        best_hypothesis = "tokenization"
    elif any(c["code"] == "A" for c in causes) and any(c["code"] == "D" for c in causes):
        best_hypothesis = "mixed"
    elif any(c["code"] == "D" for c in causes):
        best_hypothesis = "engine"
    elif any(c["code"] == "E" for c in causes):
        best_hypothesis = "confidence"

    if best_hypothesis in ("preprocessing", "tokenization"):
        decision = "A) keep MMS + improve preprocessing"
        reason = "evidence points to internal text representation as the primary weak link"
        next_move = "compare romanization/G2P variants before changing engine"
    elif best_hypothesis == "mixed":
        decision = "A) keep MMS + improve preprocessing first"
        reason = "preprocessing is clearly involved; only compare engine if preprocessing gains are small"
        next_move = "run preprocess compare variants on same RU track"
    elif best_hypothesis == "engine":
        decision = "B) compare second engine now"
        reason = "RU weakness looks acoustic/model-level rather than text-preprocessing-level"
        next_move = "test whisper-align or another forced aligner on same RU track"
    else:
        decision = "A) keep MMS + inspect preprocessing further"
        reason = "insufficient separation; cheapest next proof is preprocessing compare"
        next_move = "run preprocessing compare"

    print(f"\nDecision: {decision}")
    print(f"Reason:   {reason}")
    print(f"Next:     {next_move}")

    result = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "lpArtifact": str(LP_ARTIFACT),
        "ruArtifact": str(RU_ARTIFACT),
        "lpProvider": lp.get("provider"),
        "ruProvider": ru.get("provider"),
        "lpLanguage": lp.get("language"),
        "ruLanguage": ru.get("language"),
        "metrics": metrics,
        "badLines": bad_lines,
        "causes": causes,
        "decision": decision,
        "reason": reason,
        "nextMove": next_move,
        "preprocessingIsBottleneck": preprocessing_is_bottleneck,
        "bestHypothesis": best_hypothesis,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nComparison artifact: {OUT}")
    print(f"Size: {OUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
