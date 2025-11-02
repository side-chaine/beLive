#!/usr/bin/env python3
"""Скрипт проверяет изображения на целостность и нулевой размер.
Выводит список проблемных файлов, возвращает код 1 если есть ошибки.
"""
from pathlib import Path
from PIL import Image
import sys

EXCLUDE_DIRS = {'.git', 'node_modules', 'venv', '.venv'}
PATTERNS = ['*.png','*.jpg','*.jpeg','*.webp','*.gif']


def check_image(path: Path):
    try:
        if path.stat().st_size == 0:
            return False, 'Empty file'
        with Image.open(path) as img:
            img.verify()
        return True, None
    except Exception as e:
        return False, str(e)


def main():
    root = Path('.')
    bad = []
    checked = 0
    for pat in PATTERNS:
        for p in root.rglob(pat):
            if any(x in p.parts for x in EXCLUDE_DIRS):
                continue
            checked += 1
            ok, err = check_image(p)
            if not ok:
                bad.append((str(p), err))
                print(f"BAD: {p} -> {err}")
    print(f"Checked {checked} images")
    if bad:
        print(f"Found {len(bad)} bad images")
        # save report
        Path('reports').mkdir(exist_ok=True)
        with open('reports/bad_images.txt','w',encoding='utf-8') as f:
            for p, e in bad:
                f.write(f"{p}\t{e}\n")
        sys.exit(1)
    print("All OK")

if __name__ == '__main__':
    main()
