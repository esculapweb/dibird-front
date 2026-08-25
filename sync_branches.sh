#!/bin/bash
# Подтянуть локальные ветки после того, как PR staging → master смержен на GitHub.
#
#   ./sync_branches.sh             master ← origin/master, staging ← master, push
#   ./sync_branches.sh --no-push   то же, но staging остаётся только локально
#
# Зачем: мерж PR создаёт коммит в master, которого нет в staging. Если его не
# подтянуть, расхождение копится, и следующий PR показывает не свои изменения, а
# диф относительно давней общей базы. Сразу после мержа staging догоняет master
# чистым fast-forward — новых коммитов в staging ещё нет.
#
# Везде --ff-only намеренно: обычный merge в такой ситуации молча создал бы
# лишний merge-коммит и увёл ветки в новое расхождение вместо того, чтобы
# сказать, что что-то пошло не так. Упало — значит в ветке появились коммиты,
# которых нет в другой, и разбираться надо руками.
#
# Ветку staging после мержа не удалять: GitHub предлагает кнопку Delete branch по
# умолчанию (в GitHub-flow ветки одноразовые), но здесь staging живёт постоянно —
# удаление собьёт трекинг и потребует пуша заново.
set -e

cd "$(dirname "$0")"

PUSH=1
case "${1:-}" in
    --no-push) PUSH=0 ;;
    "") ;;
    *) echo "Неизвестный аргумент: $1 (есть только --no-push)" >&2; exit 1 ;;
esac

# checkout при грязном дереве не падает, а тащит незакоммиченные правки за собой в
# другую ветку — потом ищи, где они оказались. Проще не начинать.
if [ -n "$(git status --porcelain)" ]; then
    echo "Рабочее дерево не чистое — закоммить или спрячь правки перед синхронизацией:" >&2
    git status --short >&2
    exit 1
fi

echo "▶ master ← origin/master"
git checkout master
git pull --ff-only

echo "▶ staging ← master"
git checkout staging
if ! git merge --ff-only master; then
    echo "staging не догоняет master fast-forward'ом: в нём есть свои коммиты." >&2
    echo "Влей master руками (git merge master) и разберись с расхождением." >&2
    exit 1
fi

if [ "$PUSH" = 1 ]; then
    echo "▶ push staging"
    git push
fi

echo "✅ Ветки в одной точке: $(git log --oneline -1)"
