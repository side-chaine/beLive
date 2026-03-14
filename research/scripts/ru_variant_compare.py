#!/usr/bin/env python3
import json, re, statistics
from pathlib import Path
from datetime import datetime, timezone

ROOT   = Path.cwd()
BASE   = ROOT / "benchmarks" / "pack01" / "ru_letet"
AUDIO  = BASE / "vocals.mp3"
LYRICS = BASE / "lyrics.txt"
EXPORT = BASE / "export.json"

for p in [AUDIO, LYRICS]:
    assert p.exists(), f"MISSING: {p}"

import torch, torchaudio
print(f"torch={torch.__version__} torchaudio={torchaudio.__version__}")

def normalize_conf(raw):
    return round((max(-8.0, min(-2.0, raw)) + 8.0) / 6.0, 4)

def is_meta_line(text):
    s = text.strip()
    if not s: return True
    if re.match(r'^\[.*\]$', s): return True
    if re.match(r'^\(.*\)$', s): return True
    if s.lower().strip('[]() ') in ['припев','куплет','бридж','проигрыш','вступление','аутро','финал',
                                      'chorus','verse','bridge','outro','intro']: return True
    return False

MAP_V1 = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo',
    'ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
    'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
    'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
}
def rom_v1(text):
    r = []
    for ch in text.lower():
        if ch in MAP_V1: r.append(MAP_V1[ch])
        elif 'a' <= ch <= 'z': r.append(ch)
        elif ch == ' ': r.append(' ')
    return re.sub(r'\s+',' ',''.join(r)).strip()

MAP_V2 = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'io',
    'ж':'zh','з':'z','и':'i','й':'j','к':'k','л':'l','м':'m',
    'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'sch',
    'ъ':'','ы':'ih','ь':'','э':'eh','ю':'iu','я':'ia',
}
RU_VOWELS = set("аеёиоуыэюя")
def rom_v2(text):
    low = text.lower()
    r = []
    i = 0
    while i < len(low):
        ch = low[i]
        if ch == 'ь' and i+1 < len(low) and low[i+1] in 'яеёюи':
            combos = {'я':'ya','е':'ye','ё':'yo','ю':'yu','и':'yi'}
            r.append(combos[low[i+1]])
            i += 2
            continue
        if ch in MAP_V2: r.append(MAP_V2[ch])
        elif 'a' <= ch <= 'z': r.append(ch)
        elif ch == ' ': r.append(' ')
        i += 1
    return re.sub(r'\s+',' ',''.join(r)).strip()

MAP_V3 = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'o',
    'ж':'j','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m',
    'н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'h','ц':'c','ч':'q','ш':'x','щ':'w',
    'ъ':'','ы':'i','ь':'','э':'e','ю':'u','я':'a',
}
def rom_v3(text):
    r = []
    for ch in text.lower():
        if ch in MAP_V3: r.append(MAP_V3[ch])
        elif 'a' <= ch <= 'z': r.append(ch)
        elif ch == ' ': r.append(' ')
    return re.sub(r'\s+',' ',''.join(r)).strip()

VARIANTS = [
    ("V1_baseline", rom_v1, "Current baseline from 02B"),
    ("V2_phonetic", rom_v2, "Phonetic improved"),
    ("V3_granular", rom_v3, "Max granular"),
]

def summarize_variant(lines):
    word_confs = []
    line_confs = []
    first_confs = []
    mid_confs = []
    last_confs = []
    zero_span = 0
    word_count = 0
    last_low = 0

    for line in lines:
        words = line["words"]
        line_confs.append(line["confidence"])
        for w in words:
            word_count += 1
            word_confs.append(w["confidence"])
            if abs(w["end"] - w["start"]) < 0.03:
                zero_span += 1
        if words:
            first_confs.append(words[0]["confidence"])
            last_confs.append(words[-1]["confidence"])
            if words[-1]["confidence"] < 0.35:
                last_low += 1
            if len(words) > 2:
                mid_confs.extend(w["confidence"] for w in words[1:-1])

    word_confs_sorted = sorted(word_confs) or [0.0]
    line_confs_sorted = sorted(line_confs) or [0.0]

    return {
        "line_count": len(lines),
        "word_count": word_count,
        "usable_word_rate": round(sum(c > 0.5 for c in word_confs) / max(1, word_count), 4),
        "avg_line_conf": round(sum(line_confs) / max(1, len(line_confs)), 4),
        "median_line_conf": round(line_confs_sorted[len(line_confs_sorted)//2], 4),
        "avg_word_conf": round(sum(word_confs) / max(1, len(word_confs)), 4),
        "median_word_conf": round(word_confs_sorted[len(word_confs_sorted)//2], 4),
        "first_word_conf_avg": round(sum(first_confs) / max(1, len(first_confs)), 4),
        "mid_word_conf_avg": round(sum(mid_confs) / max(1, len(mid_confs)), 4),
        "last_word_conf_avg": round(sum(last_confs) / max(1, len(last_confs)), 4),
        "first_to_mid_drop": round(
            (sum(first_confs) / max(1, len(first_confs))) - (sum(mid_confs) / max(1, len(mid_confs))),
            4,
        ),
        "last_word_low_conf_rate": round(last_low / max(1, len(last_confs)), 4),
        "zero_span_word_rate": round(zero_span / max(1, word_count), 4),
    }

def find_dead_internal_groove(lines, top_n=5):
    scored = []
    for line in lines:
        words = line["words"]
        if len(words) < 3:
            continue
        first = words[0]["confidence"]
        inner = [w["confidence"] for w in words[1:-1]]
        if not inner:
            continue
        inner_avg = sum(inner) / len(inner)
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
            })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_n]

def tokenizer_smoke(tokenizer, prep_fn, sample_words):
    out = []
    for word in sample_words:
        _, align_words, reason = prep_fn(word)
        if reason or not align_words:
            out.append({"input": word, "ok": False, "reason": reason})
            continue
        try:
            tok = tokenizer(align_words)
            out.append({"input": word, "alignWords": align_words, "ok": True, "tokenCount": len(tok)})
        except Exception as e:
            out.append({"input": word, "alignWords": align_words, "ok": False, "reason": repr(e)})
    return out

def make_empty_line(w, reason, variant):
    return {
        "rawLineIndex": w["raw_idx"],
        "contentLineIndex": w["content_idx"],
        "text": w["text"],
        "start": round(w["start"], 3),
        "end": round(w["end"], 3),
        "confidence": 0.0,
        "words": [],
        "_debug": {
            "windowStart": round(w["start"], 3),
            "windowEnd": round(w["end"], 3),
            "skipReason": reason,
            "variant": variant,
        },
    }

def prepare_words_with_map(text, romanize_token):
    stripped = text.strip()
    if not stripped:
        return [], [], "blank"
    if is_meta_line(stripped):
        return [], [], "meta"

    display_words = re.findall(r"[А-Яа-яЁё]+", stripped.replace("—", " ").replace("–", " ").replace("-", " "))
    kept_display = []
    align_words = []

    for w in display_words:
        rw = romanize_token(w)
        if rw:
            kept_display.append(w)
            align_words.append(rw)

    if not align_words:
        return [], [], "empty_after_romanization"

    return kept_display, align_words, None

def prep_baseline(text):
    return prepare_words_with_map(text, rom_v1)

def prep_phonetic(text):
    return prepare_words_with_map(text, rom_v2)

def prep_granular(text):
    return prepare_words_with_map(text, rom_v3)

PREP_VARIANTS = [
    ("baseline_custom", prep_baseline),
    ("phonetic_ru_v2", prep_phonetic),
    ("granular_ru_v3", prep_granular),
]

print("PRE-FLIGHT")
print(f"  CWD: {ROOT}")
print(f"  AUDIO: {AUDIO}")
print(f"  LYRICS: {LYRICS}")
print(f"  EXPORT: {EXPORT}")

export = json.loads(EXPORT.read_text(encoding="utf-8"))
if "syncMarkers" not in export or not isinstance(export["syncMarkers"], list):
    raise RuntimeError("export.syncMarkers missing or not a list")

lyrics_text = LYRICS.read_text(encoding="utf-8")
raw_lines = lyrics_text.split("\n")
markers_sorted = sorted(export["syncMarkers"], key=lambda m: int(m["lineIndex"]))
if len(markers_sorted) != len(raw_lines):
    raise RuntimeError(f"syncMarkers/raw_lines mismatch: markers={len(markers_sorted)} raw_lines={len(raw_lines)}")

for i, m in enumerate(markers_sorted):
    if int(m["lineIndex"]) != i:
        raise RuntimeError(f"syncMarkers out of raw-line order at {i}: lineIndex={m['lineIndex']}")

info = torchaudio.info(str(AUDIO))
audio_total_dur = info.num_frames / info.sample_rate
marker_time_by_raw = {int(m["lineIndex"]): float(m["time"]) for m in markers_sorted}

windows = []
content_idx = 0
for raw_idx, raw_line in enumerate(raw_lines):
    start_t = marker_time_by_raw[raw_idx]
    end_t = marker_time_by_raw.get(raw_idx + 1, audio_total_dur)
    end_t = min(end_t, audio_total_dur)
    stripped = raw_line.strip()
    if not stripped or is_meta_line(raw_line):
        continue
    windows.append({
        "raw_idx": raw_idx,
        "content_idx": content_idx,
        "text": stripped,
        "start": round(start_t, 3),
        "end": round(end_t, 3),
        "duration": round(end_t - start_t, 3),
    })
    content_idx += 1

print("\nFIRST 5 WINDOWS")
for w in windows[:5]:
    print(
        f"  C{w['content_idx']:02d} R{w['raw_idx']:02d} "
        f"{w['start']:7.2f}-{w['end']:7.2f} {w['duration']:5.1f}s  "
        f"{w['text'][:50]}"
    )

bundle = torchaudio.pipelines.MMS_FA
model = bundle.get_model().eval()
tokenizer = bundle.get_tokenizer()
aligner_fn = bundle.get_aligner()
MODEL_SR = bundle.sample_rate

wav, sr = torchaudio.load(str(AUDIO))
if wav.shape[0] > 1:
    wav = wav.mean(0, keepdim=True)
if sr != MODEL_SR:
    wav = torchaudio.functional.resample(wav, sr, MODEL_SR)

def run_variant(name, prep_fn):
    aligned_lines = []
    failed_lines = []
    raw_conf_debug = []
    raw_scores = []
    word_id = 0

    def align_one_line(seg, orig_text, win_start, win_end, raw_idx, content_idx, word_id_base):
        display_words, align_words, skip_reason = prep_fn(orig_text)

        if skip_reason is not None:
            line = {
                "rawLineIndex": raw_idx,
                "contentLineIndex": content_idx,
                "text": orig_text,
                "start": round(win_start, 3),
                "end": round(win_end, 3),
                "confidence": 0.0,
                "words": [],
                "_debug": {"variant": name, "windowStart": round(win_start, 3), "windowEnd": round(win_end, 3), 
"skipReason": skip_reason},
            }
            dbg = {
                "rawLineIndex": raw_idx,
                "contentLineIndex": content_idx,
                "windowStart": round(win_start, 3),
                "windowEnd": round(win_end, 3),
                "lineRawConf": -8.0,
                "lineNormConf": 0.0,
                "wordRawConfs": [],
                "romanizedWords": [],
                "variant": name,
                "skipReason": skip_reason,
            }
            return line, word_id_base, dbg, None

        tokens = tokenizer(align_words)
        with torch.inference_mode():
            emission, _ = model(seg)
        n_frames = emission.shape[1]
        if n_frames < 2:
            return None, word_id_base, None, f"too_few_frames({n_frames})"

        seg_dur = seg.shape[1] / MODEL_SR
        ratio = seg_dur / n_frames
        token_spans = aligner_fn(emission[0], tokens)

        wid = word_id_base
        words = []
        rcs = []
        ncs = []

        for wi, spans in enumerate(token_spans):
            display = display_words[wi]
            if not spans:
                rc, nc = -8.0, 0.0
                ww = {"text": display, "start": round(win_start, 3), "end": round(win_start, 3),
                      "confidence": nc, "wordIndex": wi}
            else:
                ws = win_start + spans[0].start * ratio
                we = min(win_start + spans[-1].end * ratio, win_end)
                rc = sum(s.score for s in spans) / len(spans)
                nc = normalize_conf(rc)
                ww = {"text": display, "start": round(ws, 3), "end": round(we, 3),
                      "confidence": nc, "wordIndex": wi}
            rcs.append(float(rc))
            ncs.append(nc)
            words.append(ww)
            wid += 1

        line_norm = sum(ncs) / len(ncs) if ncs else 0.0
        line_raw = sum(rcs) / len(rcs) if rcs else -8.0

        line = {
            "rawLineIndex": raw_idx,
            "contentLineIndex": content_idx,
            "text": orig_text,
            "start": round(win_start, 3),
            "end": round(win_end, 3),
            "confidence": round(line_norm, 4),
            "words": [
                {
                    "id": f"{raw_idx}-{wi}",
                    "text": ww["text"],
                    "start": ww["start"],
                    "end": ww["end"],
                    "confidence": ww["confidence"],
                    "rawLineIndex": raw_idx,
                    "contentLineIndex": content_idx,
                    "wordIndex": wi,
                }
                for wi, ww in enumerate(words)
            ],
            "_roman": align_words,
            "_rawConf": round(line_raw, 4),
            "_debug": {"variant": name, "windowStart": round(win_start, 3), "windowEnd": round(win_end, 3)},
        }
        dbg = {
            "rawLineIndex": raw_idx,
            "contentLineIndex": content_idx,
            "windowStart": round(win_start, 3),
            "windowEnd": round(win_end, 3),
            "lineRawConf": round(line_raw, 4),
            "lineNormConf": round(line_norm, 4),
            "wordRawConfs": [round(r, 4) for r in rcs],
            "romanizedWords": align_words,
            "variant": name,
        }
        return line, wid, dbg, None

    print(f"\n=== VARIANT: {name} ===")
    smoke = tokenizer_smoke(tokenizer, prep_fn, ["лететь", "на", "сердце", "ещё", "любовь", "На-на-на"])
    for row in smoke:
        print(" ", row)

    for w in windows:
        ss = max(0, int(w["start"] * MODEL_SR))
        es = min(wav.shape[1], int(w["end"] * MODEL_SR))
        if es - ss < int(MODEL_SR * 0.15):
            aligned_lines.append(make_empty_line(w, "too_short", name))
            failed_lines.append({"rawLineIndex": w["raw_idx"], "reason": "too_short"})
            continue

        seg = wav[:, ss:es]
        try:
            line, word_id, dbg, err = align_one_line(seg, w["text"], w["start"], w["end"], w["raw_idx"], 
w["content_idx"], word_id)
        except Exception as e:
            line, dbg, err = make_empty_line(w, f"exception:{e}", name), None, repr(e)

        if err:
            aligned_lines.append(make_empty_line(w, err, name))
            failed_lines.append({"rawLineIndex": w["raw_idx"], "reason": err})
            continue

        aligned_lines.append(line)
        raw_conf_debug.append(dbg)
        raw_scores.extend(dbg["wordRawConfs"])

    for line in aligned_lines:
        raw_idx = line["rawLineIndex"]
        expected_start = round(marker_time_by_raw[raw_idx], 3)
        expected_end = round(min(marker_time_by_raw.get(raw_idx + 1, audio_total_dur), audio_total_dur), 3)
        actual_start = round(line["_debug"]["windowStart"], 3)
        actual_end = round(line["_debug"]["windowEnd"], 3)
        if abs(actual_start - expected_start) > 0.05:
            raise RuntimeError(
                f"Window mismatch raw={raw_idx}: expected_start={expected_start}, "
                f"actual_start={actual_start}"
            )
        if abs(actual_end - expected_end) > 0.05:
            raise RuntimeError(
                f"Window mismatch raw={raw_idx}: expected_end={expected_end}, actual_end={actual_end}"
            )
        if line["text"] != raw_lines[raw_idx].strip():
            raise RuntimeError(f"Text mismatch raw={raw_idx}")

    metrics = summarize_variant(aligned_lines)
    bad = find_dead_internal_groove(aligned_lines)

    artifact = {
        "source": "ai-aligner",
        "version": 1,
        "audioSource": "vocal-stem",
        "language": "ru",
        "lyricsHash": "fnv1a:diagnostic-not-needed",
        "provider": "mms_fa",
        "providerVersion": f"torchaudio-{torchaudio.__version__}-MMS_FA",
        "mode": "anchored",
        "lines": [{k:v for k,v in l.items() if k not in ("_roman","_rawConf","_debug")} for l in aligned_lines],
        "_debug": {
            "variant": name,
            "researchPreprocessing": {
                "romanization": {
                    "status": "research-only",
                    "frozenProductContract": False,
                    "method": name,
                    "displayTextPreserved": True,
                }
            },
            "metrics": metrics,
            "badLineExamples": bad,
            "failedLines": failed_lines,
        },
    }

    out_path = ROOT / "research" / "artifacts" / f"track2-real-alignment-mms-real.{name}.json"
    out_path.write_text(json.dumps(artifact, indent=2, ensure_ascii=False))
    print("METRICS", json.dumps(metrics, ensure_ascii=False))
    return {
        "name": name,
        "artifactPath": str(out_path),
        "metrics": metrics,
        "badLineExamples": bad,
        "tokenizerSmoke": smoke,
    }

results = {}
for name, fn in PREP_VARIANTS:
    results[name] = run_variant(name, fn)

baseline = results["baseline_custom"]["metrics"]
best_name = max(
    PREP_VARIANTS,
    key=lambda x: (
        results[x[0]]["metrics"]["mid_word_conf_avg"],
        results[x[0]]["metrics"]["usable_word_rate"],
        results[x[0]]["metrics"]["avg_line_conf"],
    ),
)[0]
best = results[best_name]["metrics"]

mid_gain = round(best["mid_word_conf_avg"] - baseline["mid_word_conf_avg"], 4)
usable_gain = round(best["usable_word_rate"] - baseline["usable_word_rate"], 4)
first_regression = round(best["first_word_conf_avg"] - baseline["first_word_conf_avg"], 4)

preprocessing_enough = best_name != "baseline_custom" and (
    (mid_gain >= 0.08) or (usable_gain >= 0.10)
) and (first_regression >= -0.03)

hard_verdict = "preprocessing enough" if preprocessing_enough else "not enough"
next_decision = "keep MMS + preprocessing" if preprocessing_enough else "compare second engine"

selected_src = Path(results[best_name]["artifactPath"] if preprocessing_enough else 
results["baseline_custom"]["artifactPath"])
FINAL_ARTIFACT = ROOT / "research" / "artifacts" / "track2-real-alignment-mms-real.json"
shutil.copyfile(selected_src, FINAL_ARTIFACT)

compare = {
    "generated": datetime.now(timezone.utc).isoformat(),
    "mission": "REAL-ALIGN-02E: RU preprocessing compare",
    "variants": {n: {k:v for k,v in r.items() if k != "lines"} for n, r in results.items()},
    "bestVariant": best_name,
    "deltaVsBaseline": {
        "mid_word_conf_avg": mid_gain,
        "usable_word_rate": usable_gain,
        "first_word_conf_avg": first_regression,
    },
    "hardVerdict": hard_verdict,
    "nextDecision": next_decision,
    "selectedArtifact": str(FINAL_ARTIFACT),
}
COMPARE_JSON = ROOT / "research" / "artifacts" / "track2-preprocessing-compare.json"
COMPARE_JSON.write_text(json.dumps(compare, indent=2, ensure_ascii=False))

print("\nSIDE-BY-SIDE METRICS")
for name, payload in results.items():
    m = payload["metrics"]
    print(
        f"{name:20s} usable={m['usable_word_rate']:.4f} line={m['avg_line_conf']:.4f} "
        f"word={m['avg_word_conf']:.4f} first={m['first_word_conf_avg']:.4f} "
        f"mid={m['mid_word_conf_avg']:.4f} last={m['last_word_conf_avg']:.4f} "
        f"drop={m['first_to_mid_drop']:.4f} zero={m['zero_span_word_rate']:.4f}"
    )

print("\nBAD-LINE EXAMPLES")
for name, payload in results.items():
    print(f"\n{name}")
    for ex in payload["badLineExamples"][:3]:
        print(
            f"  R{ex['rawLineIndex']:02d} C{ex['contentLineIndex']:02d} "
            f"lineConf={ex['lineConfidence']:.4f} "
            f"first={ex['firstWordConfidence']:.4f} "
            f"inner={ex['innerWordConfidenceAvg']:.4f} "
            f"text={ex['text'][:70]}"
        )

print("\nBEST VARIANT")
print(best_name)

print("\nHARD VERDICT")
print(hard_verdict)

print("\nNEXT DECISION")
print(next_decision)

print("\nSELECTED ARTIFACT")
print(FINAL_ARTIFACT)

print("\nCOMPARE REPORT")
print(COMPARE_JSON)
