#!/usr/bin/env python3
"""
TC-106: RU Post-Shaping Preview Prototype

Non-destructive phrase-local word timing optimization for RU artifact.
- Works only within phrase-local span (min word start to max word end)
- Does not use tail silence
- Expands micro function words (<=0.05s) to visual floor (0.08s)
- Budget taken only from internal gaps between words
- Preserves word order, no overlaps, fixed phrase boundaries
"""

import json
import copy
from typing import Dict, List, Any, Tuple

# Visual floor for function words
VISUAL_FLOOR = 0.08
MICRO_THRESHOLD = 0.03
SHORT_THRESHOLD = 0.05

# Function words that benefit from expansion
FUNCTION_WORDS = {
    'и', 'а', 'у', 'в', 'с', 'не', 'по', 'на', 'но', 'к', 'о', 'от', 'до', 'за', 'из',
    'об', 'под', 'при', 'про', 'над', 'для', 'со', 'во', 'ко', 'обо', 'мы', 'вы', 'они'
}


def compute_phrase_span(words: List[Dict]) -> Tuple[float, float]:
    """Compute phrase-local span from word timings."""
    if not words:
        return 0.0, 0.0
    phrase_start = min(w['start'] for w in words)
    phrase_end = max(w['end'] for w in words)
    return phrase_start, phrase_end


def compute_internal_coverage(words: List[Dict]) -> float:
    """Compute internal coverage ratio for a line."""
    if not words:
        return 0.0
    phrase_start, phrase_end = compute_phrase_span(words)
    phrase_span = phrase_end - phrase_start
    if phrase_span <= 0:
        return 0.0
    sum_word_dur = sum(w['end'] - w['start'] for w in words)
    return sum_word_dur / phrase_span


def count_micro_words(words: List[Dict]) -> int:
    """Count words with duration <= MICRO_THRESHOLD."""
    return sum(1 for w in words if w['end'] - w['start'] <= MICRO_THRESHOLD)


def count_short_words(words: List[Dict]) -> int:
    """Count words with duration <= SHORT_THRESHOLD."""
    return sum(1 for w in words if w['end'] - w['start'] <= SHORT_THRESHOLD)


def is_function_word(text: str) -> bool:
    """Check if word is a function word eligible for expansion."""
    return text.lower() in FUNCTION_WORDS


def shape_line(words: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
    """
    Apply post-shaping to a single line's words.
    
    Returns:
        (shaped_words, change_log) where change_log records what was modified
    """
    if not words:
        return [], []
    
    # Deep copy to avoid mutating original
    shaped = copy.deepcopy(words)
    change_log = []
    
    # Compute phrase span
    phrase_start, phrase_end = compute_phrase_span(shaped)
    phrase_span = phrase_end - phrase_start
    
    if phrase_span <= 0:
        return shaped, []
    
    # Identify candidates for expansion (short function words)
    candidates = []
    for i, w in enumerate(shaped):
        duration = w['end'] - w['start']
        if duration <= SHORT_THRESHOLD and is_function_word(w['text']):
            target = VISUAL_FLOOR
            deficit = target - duration
            if deficit > 0.001:  # Only if meaningful expansion needed
                candidates.append({
                    'index': i,
                    'word': w,
                    'original_duration': duration,
                    'target_duration': target,
                    'deficit': deficit
                })
    
    if not candidates:
        return shaped, []
    
    # Sort candidates by index to process left-to-right
    candidates.sort(key=lambda x: x['index'])
    
    # Compute available gaps between words
    def compute_gaps():
        gaps = []
        for i in range(len(shaped) - 1):
            gap = shaped[i + 1]['start'] - shaped[i]['end']
            gaps.append(max(0, gap))
        return gaps
    
    # Process each candidate
    for cand in candidates:
        idx = cand['index']
        deficit = cand['deficit']
        
        if deficit <= 0.001:
            continue
        
        gaps = compute_gaps()
        
        # Try to take from gap to the right first (more natural)
        expanded = False
        
        # Right gap (between this word and next)
        if idx < len(shaped) - 1 and gaps[idx] > 0.001:
            take = min(deficit, gaps[idx] * 0.8)  # Leave some gap
            if take > 0.001:
                shaped[idx]['end'] += take
                deficit -= take
                expanded = True
        
        # Left gap (between previous word and this)
        if deficit > 0.001 and idx > 0 and gaps[idx - 1] > 0.001:
            take = min(deficit, gaps[idx - 1] * 0.8)
            if take > 0.001:
                shaped[idx]['start'] -= take
                deficit -= take
                expanded = True
        
        # If still have deficit, try to push subsequent words
        if deficit > 0.001 and idx < len(shaped) - 1:
            # Check if we can shift next word and everything after
            remaining_room = phrase_end - shaped[-1]['end']
            if remaining_room > 0.001:
                shift = min(deficit, remaining_room)
                # Shift this word's end and all subsequent words
                original_end = shaped[idx]['end']
                shaped[idx]['end'] += shift
                actual_shift = shaped[idx]['end'] - original_end
                
                for j in range(idx + 1, len(shaped)):
                    shaped[j]['start'] += actual_shift
                    shaped[j]['end'] += actual_shift
                
                deficit -= actual_shift
                expanded = True
        
        # If still have deficit, try to pull previous words
        if deficit > 0.001 and idx > 0:
            remaining_room = shaped[0]['start'] - phrase_start
            if remaining_room > 0.001:
                shift = min(deficit, remaining_room)
                original_start = shaped[idx]['start']
                shaped[idx]['start'] -= shift
                actual_shift = original_start - shaped[idx]['start']
                
                for j in range(idx):
                    shaped[j]['start'] -= actual_shift
                    shaped[j]['end'] -= actual_shift
                
                deficit -= actual_shift
                expanded = True
        
        # Record change
        new_duration = shaped[idx]['end'] - shaped[idx]['start']
        if new_duration > cand['original_duration'] + 0.001:
            change_log.append({
                'index': idx,
                'text': cand['word']['text'],
                'original_duration': round(cand['original_duration'], 3),
                'new_duration': round(new_duration, 3),
                'expansion': round(new_duration - cand['original_duration'], 3),
                'remaining_deficit': round(deficit, 3)
            })
    
    return shaped, change_log


def process_artifact(input_path: str) -> Dict[str, Any]:
    """Process entire artifact and return shaped result with metrics."""
    
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Deep copy for output
    shaped_data = copy.deepcopy(data)
    
    # Track changes
    all_changes = []
    line_metrics_before = []
    line_metrics_after = []
    
    for line_idx, line in enumerate(data['lines']):
        words = line.get('words', [])
        if not words:
            continue
        
        # Metrics before
        before_coverage = compute_internal_coverage(words)
        before_micro = count_micro_words(words)
        before_short = count_short_words(words)
        
        line_metrics_before.append({
            'rawLineIndex': line['rawLineIndex'],
            'lineText': line['text'],
            'internalCoverage': round(before_coverage, 3),
            'microWords': before_micro,
            'shortWords': before_short
        })
        
        # Apply shaping
        shaped_words, changes = shape_line(words)
        
        # Update shaped data
        shaped_data['lines'][line_idx]['words'] = shaped_words
        
        # Record changes
        for ch in changes:
            ch['lineIndex'] = line['rawLineIndex']
            ch['lineText'] = line['text']
            all_changes.append(ch)
        
        # Metrics after
        after_coverage = compute_internal_coverage(shaped_words)
        after_micro = count_micro_words(shaped_words)
        after_short = count_short_words(shaped_words)
        
        line_metrics_after.append({
            'rawLineIndex': line['rawLineIndex'],
            'lineText': line['text'],
            'internalCoverage': round(after_coverage, 3),
            'microWords': after_micro,
            'shortWords': after_short,
            'coverageImprovement': round(after_coverage - before_coverage, 3)
        })
    
    return {
        'shaped_data': shaped_data,
        'changes': all_changes,
        'line_metrics_before': line_metrics_before,
        'line_metrics_after': line_metrics_after
    }


def generate_compare_report(result: Dict) -> Dict:
    """Generate comparison report."""
    
    before = result['line_metrics_before']
    after = result['line_metrics_after']
    
    # Aggregate metrics
    before_coverages = [m['internalCoverage'] for m in before]
    after_coverages = [m['internalCoverage'] for m in after]
    
    before_micro_total = sum(m['microWords'] for m in before)
    after_micro_total = sum(m['microWords'] for m in after)
    
    before_short_total = sum(m['shortWords'] for m in before)
    after_short_total = sum(m['shortWords'] for m in after)
    
    before_poor_lines = sum(1 for m in before if m['internalCoverage'] < 0.7)
    after_poor_lines = sum(1 for m in after if m['internalCoverage'] < 0.7)
    
    # Top changed words
    sorted_changes = sorted(result['changes'], key=lambda x: -x['expansion'])
    top_changed = sorted_changes[:20]
    
    # Top improved lines
    improved_lines = [m for m in result['line_metrics_after'] if m['coverageImprovement'] > 0]
    sorted_improved = sorted(improved_lines, key=lambda x: -x['coverageImprovement'])
    top_improved = sorted_improved[:10]
    
    # Preview for specific lines
    preview_lines = [
        'И ты летать не стал',
        'И поднял ты глаза',
        'И по земле ходить',
        'А у птиц свободе учиться'
    ]
    
    previews = {}
    for preview_text in preview_lines:
        for m_before, m_after in zip(before, after):
            if preview_text in m_before['lineText']:
                # Find the line in shaped data for word details
                line_idx = None
                for i, line in enumerate(result['shaped_data']['lines']):
                    if preview_text in line['text']:
                        line_idx = i
                        break
                
                if line_idx is not None:
                    words_before = [
                        {'text': w['text'], 'start': w['start'], 'end': w['end'],
                         'duration': round(w['end'] - w['start'], 3)}
                        for w in result['shaped_data']['lines'][line_idx].get('_original_words', 
                            result['shaped_data']['lines'][line_idx]['words'])
                    ]
                    words_after = [
                        {'text': w['text'], 'start': w['start'], 'end': w['end'],
                         'duration': round(w['end'] - w['start'], 3)}
                        for w in result['shaped_data']['lines'][line_idx]['words']
                    ]
                    
                    previews[preview_text] = {
                        'before': {
                            'internalCoverage': m_before['internalCoverage'],
                            'words': words_before
                        },
                        'after': {
                            'internalCoverage': m_after['internalCoverage'],
                            'words': words_after
                        }
                    }
                break
    
    return {
        'summary': {
            'words_micro_le_003': {
                'before': before_micro_total,
                'after': after_micro_total,
                'improvement': before_micro_total - after_micro_total
            },
            'words_short_le_005': {
                'before': before_short_total,
                'after': after_short_total,
                'improvement': before_short_total - after_short_total
            },
            'mean_internal_coverage': {
                'before': round(sum(before_coverages) / len(before_coverages), 3),
                'after': round(sum(after_coverages) / len(after_coverages), 3),
                'improvement': round(sum(after_coverages) / len(after_coverages) - 
                                    sum(before_coverages) / len(before_coverages), 3)
            },
            'median_internal_coverage': {
                'before': round(sorted(before_coverages)[len(before_coverages) // 2], 3),
                'after': round(sorted(after_coverages)[len(after_coverages) // 2], 3)
            },
            'lines_with_coverage_lt_070': {
                'before': before_poor_lines,
                'after': after_poor_lines,
                'improvement': before_poor_lines - after_poor_lines
            }
        },
        'top_20_changed_words': top_changed,
        'top_10_improved_lines': [
            {
                'rawLineIndex': m['rawLineIndex'],
                'lineText': m['lineText'],
                'internalCoverageBefore': next(
                    b['internalCoverage'] for b in before 
                    if b['rawLineIndex'] == m['rawLineIndex']
                ),
                'internalCoverageAfter': m['internalCoverage'],
                'improvement': m['coverageImprovement']
            }
            for m in top_improved
        ],
        'line_previews': previews
    }


def main():
    input_path = 'research/artifacts/track2-real-alignment-mms-real.json'
    output_path = 'research/artifacts/track2-real-alignment-mms-real.shaped.preview.json'
    report_path = 'research/artifacts/track2-post-shape-preview.compare.json'
    
    print("TC-106: RU Post-Shaping Preview Prototype")
    print("=" * 60)
    
    # Process artifact
    print(f"\nProcessing: {input_path}")
    result = process_artifact(input_path)
    
    # Save shaped artifact
    print(f"Saving shaped artifact: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result['shaped_data'], f, ensure_ascii=False, indent=2)
    
    # Generate and save report
    print(f"Generating compare report: {report_path}")
    report = generate_compare_report(result)
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    s = report['summary']
    print(f"\nMicro words (<=0.03s): {s['words_micro_le_003']['before']} → {s['words_micro_le_003']['after']} "
          f"(-{s['words_micro_le_003']['improvement']})")
    print(f"Short words (<=0.05s): {s['words_short_le_005']['before']} → {s['words_short_le_005']['after']} "
          f"(-{s['words_short_le_005']['improvement']})")
    print(f"Mean internal coverage: {s['mean_internal_coverage']['before']:.1%} → "
          f"{s['mean_internal_coverage']['after']:.1%} "
          f"(+{s['mean_internal_coverage']['improvement']:.1%})")
    print(f"Lines with coverage < 70%: {s['lines_with_coverage_lt_070']['before']} → "
          f"{s['lines_with_coverage_lt_070']['after']} "
          f"(-{s['lines_with_coverage_lt_070']['improvement']})")
    
    print(f"\nTotal words modified: {len(result['changes'])}")
    print(f"\nTop improvements:")
    for ch in report['top_10_improved_lines'][:5]:
        print(f"  Line {ch['rawLineIndex']}: {ch['internalCoverageBefore']:.1%} → "
              f"{ch['internalCoverageAfter']:.1%} (+{ch['improvement']:.1%}) '{ch['lineText']}'")
    
    print("\n" + "=" * 60)
    print("Done!")
    print("=" * 60)


if __name__ == '__main__':
    main()
