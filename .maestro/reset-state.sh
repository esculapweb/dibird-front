#!/bin/bash
# Детерминированный сброс перед e2e-прогоном: чистит данные тестового
# аккаунта на локальном бэке и локальное состояние приложения на эмуляторе.
#
# Зачем: флоу проверяют счётчики («в дневнике 1 наблюдение», «мест стало
# больше»), а каждое падение оставляет за собой недосозданные/лишние записи.
# Следующий прогон стартует с испорченного аккаунта, ломаются count-проверки
# в соседних флоу — и в отчёте появляются падения, к настоящей причине
# отношения не имеющие. Сброс убирает этот источник ложных сигналов.
#
# НЕ вызывается из run.sh по умолчанию (`pm clear` стоит одного лишнего
# логина в bootstrap): запускать руками или через `npm run e2e:android --
# --reset` (см. RESET в run.sh).
#
# `pm clear` безопасен для bootstrap: сессия из SecureStore пропадёт, но
# common/android-bootstrap.yaml умеет логиниться по email/паролю, а онбординг
# после чистки не всплывёт — isOnboardingPending() (util/storageHelper.ts)
# при отсутствии ключа onboarding_pending возвращает false, а ставит его
# только регистрация.
set -e
cd "$(dirname "$0")/.."

APP_ID="${APP_ID:-com.dibird.app}"
BACKEND_DIR="${BACKEND_DIR:-/Users/esculapweb/Py/dibird/docker/dibird_local}"

ENV_FILE=".maestro/.env.local"
if [ -f "$ENV_FILE" ]; then
  # shellcheck source=/dev/null
  source "$ENV_FILE"
fi
if [ -z "$TEST_EMAIL" ]; then
  echo "TEST_EMAIL не задан — заполни $ENV_FILE (тот же файл, что читает run.sh)." >&2
  exit 1
fi

# --- 1. Данные тестового аккаунта на бэке -----------------------------------
# Observation удаляем первым: он ссылается на Diary/Place, и хотя каскад бы
# отработал сам, явный порядок делает вывод счётчиков честным.
if [ -d "$BACKEND_DIR" ]; then
  echo "Сброс данных аккаунта $TEST_EMAIL на локальном бэке…"
  (cd "$BACKEND_DIR" && docker compose exec -T \
    -e TEST_EMAIL="$TEST_EMAIL" web python manage.py shell) <<'PY'
import os

from myapi.models import Diary, Observation, Place

email = os.environ["TEST_EMAIL"]
by_user = {"profile__user__email__iexact": email}

for model in (Observation, Diary, Place):
    deleted, _ = model.objects.filter(**by_user).delete()
    print(f"{model.__name__}: удалено {deleted}")

for model in (Observation, Diary, Place):
    print(f"{model.__name__}: осталось {model.objects.filter(**by_user).count()}")
PY
else
  echo "Каталог бэкенда $BACKEND_DIR не найден — пропускаю очистку данных." >&2
fi

# --- 2. Локальное состояние приложения --------------------------------------
# adb на PATH может не быть — те же кандидаты, что и в run.sh.
if ! command -v adb >/dev/null 2>&1; then
  for candidate in "$ANDROID_HOME" "$ANDROID_SDK_ROOT" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -n "$candidate" ] && [ -x "$candidate/platform-tools/adb" ]; then
      export PATH="$PATH:$candidate/platform-tools"
      break
    fi
  done
fi
if ! command -v adb >/dev/null 2>&1; then
  echo "adb не найден — локальное состояние приложения не очищено." >&2
  exit 1
fi

TARGET=$(adb devices 2>/dev/null | grep -E "^(emulator-[0-9]+|[A-Za-z0-9]+)\s+device$" | head -1 | cut -f1)
if [ -z "$TARGET" ]; then
  echo "Нет запущенного Android-эмулятора/устройства — локальное состояние не очищено." >&2
  exit 1
fi

echo "Очистка данных $APP_ID на $TARGET (SQLite-зеркало, AsyncStorage, SecureStore)…"
adb -s "$TARGET" shell pm clear "$APP_ID"

echo "Готово: аккаунт и приложение в исходном состоянии."
