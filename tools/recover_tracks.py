#!/usr/bin/env python3
"""Утилита-помощник для восстановления/экспорта треков/данных (пример-заготовка).
Реализуйте под конкретный формат IndexedDB/экспортов проекта.
"""
from pathlib import Path
import json


def export_indexeddb_json(src_dir: Path, out_file: Path):
    # Заглушка — адаптируйте под формат экспорта проекта
    data = {}
    # TODO: реализовать парсинг
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--src', default='.', help='директория с экспортом')
    p.add_argument('--out', default='reports/tracks_export.json')
    args = p.parse_args()
    Path('reports').mkdir(exist_ok=True)
    export_indexeddb_json(Path(args.src), Path(args.out))
    print('Exported ->', args.out)
