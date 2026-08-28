#!/usr/bin/env bash
# sshfs-watchdog — держит Mac⇄PC монт живым (Ц3/Sonnet 3: 3-й сбой mountpoint = закономерность, не случайность)
# Запуск на Mac: nohup ~/beLive-pc-watchdog.sh >/tmp/sshfs-watchdog.log 2>&1 &
MOUNT="$HOME/beLive-pc"
REMOTE="nikit@<PC-HOST>:/home/nikit/projects/beLive"   # ✏️ Мак: подставь свой PC-host (ssh alias)
OPTS="-o reconnect,ServerAliveInterval=15,ServerAliveCountMax=3,allow_other"

while true; do
  if ! mountpoint -q "$MOUNT" 2>/dev/null; then
    echo "[watchdog] $(date -Is) mount DOWN — remount"
    mkdir -p "$MOUNT"
    if sshfs "$REMOTE" "$MOUNT" $OPTS; then
      echo "[watchdog] $(date -Is) remounted OK"
    else
      echo "[watchdog] $(date -Is) remount FAILED (ssh/network?)"
    fi
  fi
  sleep 30
done
