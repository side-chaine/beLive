# mms-workbench-01

Purpose:
Systematically tune and evaluate MMS forced alignment quality without changing app architecture.

Frozen truths:
- App-side word-sync architecture is already proven.
- Forced alignment remains the primary direction.
- Mock phase is closed.
- This workbench exists to improve timing quality, especially on RU.
- Line-windowed mode is primary.
- Full-song mode is control only.
- Original lyrics text remains canonical display truth.
- Transliteration/romanization may be used only as engine input.

Core outputs per run:
1. alignment artifact (`*.alignment.json`)
2. debug sidecar (`*.debug.json`)
3. human report (`*.report.txt`)

Benchmark policy:
- LP / EN is control
- RU / Letet is the main tuning target

Important marker-source rule:
Benchmark manifests may point to export JSON files that store coarse timing under either:
- `markers`
- `syncMarkers`

Runner must later support:
`markers ?? syncMarkers`

Phase rule:
Do not backend-first this workbench.
Do not redesign frontend.
Do not switch engines before MMS is fairly squeezed.
