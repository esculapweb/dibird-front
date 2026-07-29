#!/bin/bash
# Гоняет iOS- и Android-батчи одновременно: два `run.sh` в фоне, по логу на
# платформу, общий итог в конце. Полный прогон — это ~15 флоу на каждой
# стороне, и последовательно он занимает вдвое больше, чем нужно: симулятор и
# эмулятор друг друга не ждут ничем, кроме нас.
#
# Что делает параллельный прогон возможным (и почему это не «просто два
# терминала»):
#  - Разные аккаунты. run.sh берёт IOS_EMAIL/ANDROID_EMAIL из .env.local, и на
#    бэке два прогона не пересекаются. С общим аккаунтом соседний прогон менял
#    бы те же счётчики между `copyTextFrom` и проверкой — падения были бы
#    невоспроизводимыми.
#  - Один reap на двоих. run.sh при старте убивает залипшие `maestro.cli.AppKt`
#    от прошлых прогонов (см. комментарий там), но отличить их от живого
#    соседа он не может — запущенный вторым убил бы первого. Поэтому reap
#    делается здесь, один раз, до старта обоих, а самим run.sh он выключается
#    через E2E_NO_REAP.
#  - Metro один. Обе платформы ходят на localhost:8081 (iOS — общий с хостом
#    сетевой стек, Android — `adb reverse` из run.sh), и один dev-server
#    спокойно раздаёт бандл двум клиентам.
#
# Аргументы прокидываются в обе платформы как есть: `npm run e2e:parallel --
# .maestro/onboarding.yaml` прогонит один флоу на обеих.
set -e
cd "$(dirname "$0")/.."

LOG_DIR=".maestro/.logs"
mkdir -p "$LOG_DIR"
IOS_LOG="$LOG_DIR/ios.log"
ANDROID_LOG="$LOG_DIR/android.log"

# Тот самый reap, ради которого run.sh получил E2E_NO_REAP, — здесь он ещё
# безопасен: своих процессов мы пока не запускали.
STALE_PIDS=$(pgrep -f "maestro\.cli\.AppKt" 2>/dev/null || true)
if [ -n "$STALE_PIDS" ]; then
  echo "Убиваю залипшие процессы Maestro от прошлых прогонов: $(echo "$STALE_PIDS" | tr '\n' ' ')" >&2
  # shellcheck disable=SC2086
  kill $STALE_PIDS 2>/dev/null || true
  sleep 2
  STILL=$(pgrep -f "maestro\.cli\.AppKt" 2>/dev/null || true)
  # shellcheck disable=SC2086
  [ -n "$STILL" ] && kill -9 $STILL 2>/dev/null || true
fi

# Отладочные логи Maestro (не наши, из $LOG_DIR) складываются в общий
# ~/Library/Logs/maestro, и при старте Maestro подчищает там старые каталоги,
# оставляя последние несколько. Когда половины стартуют одновременно, вторая
# успевает удалить каталог, который первая только что завела, — и та падает на
# своём же завершающем шаге, уже напечатав результаты всех флоу:
#
#   Exception in thread "main" java.nio.file.NoSuchFileException:
#     ~/Library/Logs/maestro/<timestamp>_<pid>
#     at maestro.debuglog.DebugLogStore.finalizeRun
#
# Хуже, чем просто мусор в выводе: после этого исключения JVM не выходит
# (живой не-daemon поток драйвера), прогон висит бесконечно, и `wait` ниже
# никогда не вернётся. Чистим каталог сами и заранее — тогда ни одной из
# половин нечего удалять на старте. Терять там нечего: это отладочные логи
# прошлых прогонов, Maestro и сам их ротирует, а артефакты конкретного
# прогона (скриншоты, иерархии) живут отдельно, в ~/.maestro/tests/.
rm -rf "$HOME/Library/Logs/maestro"

IOS_PID=""
ANDROID_PID=""
# Без этого Ctrl-C убивает только сам скрипт: обе половины остаются в фоне,
# держат устройства и следующий прогон встречает ровно тот залипший JVM, про
# который написано выше.
cleanup() {
  trap - INT TERM
  [ -n "$IOS_PID" ] && kill "$IOS_PID" 2>/dev/null || true
  [ -n "$ANDROID_PID" ] && kill "$ANDROID_PID" 2>/dev/null || true
  pkill -f "maestro\.cli\.AppKt" 2>/dev/null || true
  exit 130
}
trap cleanup INT TERM

echo "iOS     -> $IOS_LOG"
echo "Android -> $ANDROID_LOG"
echo "Живой вывод: tail -f $IOS_LOG $ANDROID_LOG"
echo ""

# Вывод не смешивается в терминале, а раскладывается по логам: Maestro рисует
# прогресс ANSI-escape'ами поверх уже напечатанного, и два таких потока в один
# tty дают нечитаемую кашу вместо отчёта. Логи целиком печатаются в конце.
E2E_NO_REAP=1 bash .maestro/run.sh ios "$@" >"$IOS_LOG" 2>&1 &
IOS_PID=$!
E2E_NO_REAP=1 bash .maestro/run.sh android "$@" >"$ANDROID_LOG" 2>&1 &
ANDROID_PID=$!

# `wait` возвращает код упавшей половины, а `set -e` на этом бы и вышел — не
# дождавшись второй и не напечатав ни одного лога.
IOS_STATUS=0
wait "$IOS_PID" || IOS_STATUS=$?
ANDROID_STATUS=0
wait "$ANDROID_PID" || ANDROID_STATUS=$?
trap - INT TERM

echo ""
echo "================ iOS ($IOS_LOG) ================"
cat "$IOS_LOG"
echo ""
echo "================ Android ($ANDROID_LOG) ================"
cat "$ANDROID_LOG"

echo ""
echo "================ Итог ================"
[ "$IOS_STATUS" -eq 0 ] && echo "iOS:     OK" || echo "iOS:     FAILED (exit $IOS_STATUS)"
[ "$ANDROID_STATUS" -eq 0 ] && echo "Android: OK" || echo "Android: FAILED (exit $ANDROID_STATUS)"

[ "$IOS_STATUS" -eq 0 ] && [ "$ANDROID_STATUS" -eq 0 ]
