MMS Workbench 01 — Offloaded Execution Bundle

Purpose:
Run `research/mms-workbench-01/run.py` in a supported external environment
(Colab / Linux / other machine) because local MMS model download/runtime
is blocked on the current machine.

Included source-of-truth files:
- runner: `../run.py`
- benchmark manifests:
  - `benchmarks/lp_en.json`
  - `benchmarks/ru_letet.json`
- preset files:
  - `presets/lp_windowed_baseline.json`
  - `presets/ru_windowed_baseline.json`
  - `presets/ru_clean_text.json`
  - `presets/ru_phoneticish.json`
  - `presets/ru_more_padding.json`

Required external files (must exist relative to repo root):
- benchmarks/pack01/lp_breaking_the_habit/vocals.mp3
- benchmarks/pack01/lp_breaking_the_habit/lyrics.txt
- benchmarks/pack01/lp_breaking_the_habit/export.json
- benchmarks/pack01/ru_letet/vocals.mp3
- benchmarks/pack01/ru_letet/lyrics.txt
- benchmarks/pack01/ru_letet/export.json

Minimal setup:
1. create Python 3.11 environment
2. install requirements.txt
3. run one command, example:

python research/mms-workbench-01/run.py single \
  --benchmark research/mms-workbench-01/benchmarks/lp_en.json \
  --preset research/mms-workbench-01/presets/lp_windowed_baseline.json

Current local blocker:
MMS model download from:
https://dl.fbaipublicfiles.com/mms/torchaudio/ctc_alignment_mling_uroman/model.pt
is too heavy / unreliable on the current local machine/network.

Goal of offloaded phase:
prove real execution of the workbench runner in a supported environment.
