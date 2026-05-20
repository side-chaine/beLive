# beLive

**beLive** — a PWA for vocalists and musicians. Rehearse, sync lyrics, mix stems, and perform — all in one app, offline-ready.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Pages live](https://img.shields.io/badge/Pages-live-brightgreen)](https://side-chaine.github.io/beLive)
[![DCO required](https://img.shields.io/badge/DCO-required-blue)](https://github.com/side-chaine/beLive/blob/main/.github/workflows/dco.yml)
[![Dependabot enabled](https://img.shields.io/badge/Dependabot-enabled-success)](https://github.com/side-chaine/beLive/blob/main/.github/dependabot.yml)

---

## What it does

beLive gives vocalists a complete rehearsal environment: synchronized lyrics tied to audio, a multi-stem mixer, block-based song structure navigation, and multiple performance modes — from private practice to concert display.

Load a track, paste lyrics, place sync markers, and your session is ready. Export as ZIP, import anywhere, no network required.

---

## Modes

**Rehearsal** — the main practice surface. Synchronized lyrics with block navigation (Verse / Chorus / Bridge), multi-stem mixer with visual waveforms, pitch controls, and recording.

**Karaoke** — full-screen lyrics display, synced word-by-word highlight.

**Concert** — clean display for live performance on external screens.

**Live** — minimal real-time mode for on-stage use.

---

## Screenshots

| Rehearsal — synchronized lyrics | Rehearsal — stems mixer |
|---|---|
| ![Rehearsal lyrics view](Docs/screenshots/rehearsal_lyrics.png) | ![Stems mixer](Docs/screenshots/rehearsal_stems_mixer.png) |

| Visual stems — live waveforms | Lyrics input |
|---|---|
| ![Visual stems](Docs/screenshots/rehearsal_visual_stems.png) | ![Lyrics input](Docs/screenshots/lyrics_input.png) |

---

## Key features

**Synchronized lyrics** — line-level sync via manual marker placement. Word-level highlight via Meta MMS forced alignment pipeline.

**Block system (TrackMap)** — assign Verse / Chorus / Bridge blocks, navigate by clicking wagons in the top bar, loop any block with one click.

**Multi-stem mixer** — individual faders for Inst / Bass / Drums / Guitar / Keys / Vox. Visual mode shows live waveforms per stem.

**ZIP format** — self-contained portable track bundle: audio stems + lyrics + sync markers + cover art. Export → import → ready, fully offline.

**PWA** — installable, works offline after first load.

**Takes** — record practice takes, compare waveforms, track progress over time.

**Quest system** — structured vocal exercises: echo, tempo ladder, backing ladder, fill-select.

---

## Tech stack

| Layer | Tech |
|---|---|
| UI | React 19 + TypeScript 5.9 |
| Build | Vite 5 + PWA (Workbox) |
| State | Zustand 5 (17 stores) |
| Audio | Web Audio API (AudioEngineV2) |
| Persistence | IndexedDB (idb.service) |
| Word sync | Meta MMS via Kaggle batch pipeline |
| Testing | Vitest + Playwright |

---

## Quick start

```bash
git clone https://github.com/side-chaine/beLive.git
cd beLive
npm install
npm run dev
```

Open `http://localhost:5173`.

To run tests:
```bash
npm test
```

To build:
```bash
npm run build
```

---

## Repo structure

```
src/
├── audio/          # AudioEngineV2 — transport, stems, loader
├── bridges/        # React ↔ legacy boundary bridges
├── components/     # UI components (ControlDeck, MixerPanel, WagonTrain…)
├── exercises/      # Quest / exercise system
├── performance/    # Performance budget and FX tier system
├── services/       # IDB, upload, cover art, lyrics, track orchestrator
├── slot-matrix/    # Block transition slot engine
├── stem/           # Stem store and types
├── sync/           # Sync editor, waveform canvas, word-sync pipeline
├── takes/          # Recording takes system
├── triggers/       # Word highlight trigger engine (60Hz)
css/                # Legacy boundary styles
js/                 # Legacy boundary shells (6 files, not business logic)
docs/               # Architecture docs, decisions, guides
research/           # MMS alignment workbench and artifacts
scripts/            # mock-align-server and batch tools
```

---

## ZIP track format

A `.zip` bundle contains everything needed to reconstruct a track offline:

```
track-name.zip
├── track-name.mp3          # Instrumental stem
├── track-name_vocals.mp3   # Vocal stem (optional)
├── stems/                  # Additional stems (optional)
├── lyrics.txt              # Clean lyrics text
├── cover.jpg               # Cover art binary (optional)
├── export.json             # Markers + block structure + metadata
└── alignment.json          # Word-sync alignment (optional)
```

See `docs/architecture/zip-pipeline.md` for full spec.

---

## Architecture docs

Full architecture is in `docs/architecture/`. Key docs:

- `architecture-map-2.1.md` — master system map, ownership matrix, full lifecycle
- `audio-engine.md` — AudioEngineV2 transport reference
- `sync-system.md` — line sync and word sync pipeline
- `zip-pipeline.md` — export/import format spec
- `exercises-system.md` — quest and exercise runtime
- `takes-system.md` — recording and waveform system

---

## Contributing

See `contributing.md`. Short version: fork → new branch → PR. All PRs must be DCO-signed:

```bash
git commit -s -m "your message"
# or add manually: Signed-off-by: Name <email>
```

---

## License

MIT — see `LICENSE`.

---

## Contact

**Nikita Cheremisinov** — [@side-chaine](https://github.com/side-chaine) — nikitosss007@gmail.com
