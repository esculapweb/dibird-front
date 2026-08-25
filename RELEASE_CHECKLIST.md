# Чек-лист тестов перед релизом DiBird

Документ фиксирует, что обязано быть зелёным перед публикацией релиза, и
какие сценарии нужно вручную прогнать руками, потому что автотестов на них
ещё нет.

## 1. Обязательный автоматический гейт (блокирует релиз, если красный)

```bash
npm run check          # tsc --noEmit && eslint .
npm run test           # весь текущий jest-набор, включая repository-слой
                        # (diary/observation/place/alertSettings/profile —
                        # см. hooks/repositories/__tests__/, реальная sqlite
                        # через testDb.ts на checked-in миграциях, без мока
                        # drizzle)
```

`npm run check` (в CI разбит на `npm run typecheck` + `npm run lint`,
чтобы в сводке прогона было видно упавший гейт) и `npm run test` (в CI —
`npm run test:ci` = `jest --forceExit`, см. ниже почему) гоняются
автоматически в GitHub Actions ([.github/workflows/ci.yml](.github/workflows/ci.yml))
на каждый pull request в master, на сам master и по кнопке
(`workflow_dispatch` — ручной прогон с любой ветки); ручной прогон перед
релизом остаётся дополнительной подстраховкой, а не единственной линией
защиты. Мерж красного PR при этом технически не блокируется: branch
protection на private-репозитории требует GitHub Pro.

`--forceExit` нужен только в CI: repository-тесты держат нативные
`better-sqlite3`-хендлы открытыми на весь воркер-процесс (см. коммент в
`hooks/repositories/testDb.ts`) — локально jest сам форсированно
завершается после предупреждения и команда всё равно выходит за секунды,
но под CI-контейнером шаг без `--forceExit` зависал бесконечно
("In progress" без дальнейшего вывода), несмотря на то что все тесты уже
прошли зелёными.

`npm run e2e` / `npm run e2e:android` пока **не входят** в автоматический
гейт (нет CI-раннера с эмулятором/симулятором и собранным dev-client
билдом), но реальные Maestro-флоу уже покрывают основные пути и годятся
для ручного прогона перед релизом:

```bash
npm run e2e:ios          # iOS-симулятор (то же, что `npm run e2e` без аргументов)
npm run e2e:android      # Android-эмулятор
npm run e2e:parallel     # обе платформы одновременно (см. ниже)
npm run e2e:ios -- .maestro/guest-browse.yaml               # можно указать один флоу явно
npm run e2e:android -- .maestro/offline-create-place.yaml   # на обеих платформах
npm run e2e:parallel -- .maestro/onboarding.yaml            # один флоу сразу на обеих
npm run e2e:android -- --reset                              # со сбросом состояния (см. ниже)
```

Аккаунт у каждой платформы **свой**: `IOS_EMAIL`/`IOS_PASSWORD` и
`ANDROID_EMAIL`/`ANDROID_PASSWORD` в `.maestro/.env.local` (gitignored),
`run.sh` выбирает пару по платформе и отдаёт её в Maestro под прежними
именами `TEST_EMAIL`/`TEST_PASSWORD` — сами флоу про платформу не знают.
Общий аккаунт делал параллельный прогон бессмысленным: флоу проверяют
счётчики («мест стало больше», «в дневнике 1 наблюдение»), и соседний
прогон правил бы те же цифры прямо между `copyTextFrom` и проверкой.

Смена аккаунта на устройстве (например, после правки `.env.local`) — это
сброс локального состояния, потому что сессия переживает перезапуск.
Android: `adb shell pm clear com.dibird.app` (его же делает
`.maestro/reset-state.sh`). iOS: **переустановить приложение**

```bash
UDID=$(xcrun simctl list devices | grep -i booted | grep -oE '[0-9A-F-]{36}')
APP=~/Library/Developer/Xcode/DerivedData/DiBirdDev-*/Build/Products/Debug-iphonesimulator/DiBirdDev.app
xcrun simctl uninstall "$UDID" com.dibird.app.dev && xcrun simctl install "$UDID" $APP
```

Именно переустановить, а не удалять каталоги внутри data-контейнера:
токен лежит в Keychain (expo-secure-store), то есть **вне** контейнера — от
чистки каталогов приложение остаётся залогиненным старым аккаунтом. А
`rm -rf` по `Library/` вдобавок оставляет за собой битый кэш ассетов:
expo-asset создаёт на месте `Library/Caches/ExponentAsset-<md5>.ttf` пустой
каталог и после этого валится `UnableToDownloadAssetException` на каждом
запуске — иконочные шрифты не грузятся, все `Ionicons` рисуются нулевой
ширины и пропадают из accessibility-дерева. Наружу это выглядит как падение
`common/credential-entry.yaml` на `password-input-toggle-visibility`
(«глаза» у поля пароля просто нет), и никакой перезапуск это не чинит.
Uninstall/install состояние сбрасывает целиком, включая Keychain, и шрифты
на первом же запуске скачиваются нормально. Только для dev-client: в
релизной сборке ассеты вшиты в бандл и с Metro не качаются.

`npm run e2e:parallel` (`.maestro/run-parallel.sh`) запускает обе половины
в фоне, по логу на платформу в `.maestro/.logs/` (`tail -f` во время
прогона), печатает оба лога целиком в конце и общий итог; выход ненулевой,
если упала хоть одна. Metro один на двоих — обе платформы ходят на
`localhost:8081` (iOS делит сетевой стек с хостом, Android — через `adb
reverse` из `run.sh`). Reap залипших `maestro.cli.AppKt` от прошлых
прогонов при этом делается один раз в самом `run-parallel.sh`, до старта
обеих половин: изнутри `run.sh` он выключен (`E2E_NO_REAP`), потому что
отличить залипший процесс от живого соседа он не может и запущенный вторым
убивал бы первого.

Там же чистится `~/Library/Logs/maestro`. Обе половины пишут отладочные логи
в этот общий каталог и подчищают его на старте, поэтому стартовавшая второй
успевала снести каталог первой — и та падала на собственном завершающем шаге
(`NoSuchFileException` в `DebugLogStore.finalizeRun`), уже отчитавшись по
всем своим флоу. Само по себе это был бы лишь мусор в выводе, но после
исключения JVM не выходит (остаётся живой поток драйвера) и прогон висит
бесконечно. Артефакты конкретного прогона — скриншоты и иерархии, на которые
ссылается отчёт Maestro при падении, — лежат отдельно, в `~/.maestro/tests/`,
и эта чистка их не трогает.

Платформа флоу задаётся тегами в его шапке, `run.sh` фильтрует скан
каталога по `--include-tags`. Состав на сегодня:

| Флоу | iOS | Android |
| --- | :-: | :-: |
| `login`, `guest-browse`, `guest-login-return` | ✅ | — |
| `logout`, `settings-language-switch` | ✅ | ✅ |
| `onboarding` | ✅ | ✅ |
| `guest-deeplink-no-session` | ✅ | ✅ |
| `online-create-{observation,diary,place}` | ✅ | ✅ |
| `online-create-place-location-denied` | ✅ | ✅ |
| `online-nested-observation` | ✅ | ✅ |
| `taxonomy-tree-filters` | ✅ | ✅ |
| `list-sort-persist`, `list-filters` | — | ✅ |
| `offline-*` (8 флоу) | — | ✅ |

Почему не всё общее:

- `offline-*` — `toggleAirplaneMode` есть только на Android (раздел 6);
- `list-sort-persist` / `list-filters` — iOS схлопывает содержимое
  gorhom-шторки в один accessibility-элемент, и внутренности шторок
  сортировки и фильтров списка до Maestro не доходят. Шторка фильтров
  каталога (`taxonomy-tree-filters`) при этом доступна: разница в общем
  заголовке (`title` у `BottomSheet.showContent`). То же самое, что не
  видит Maestro, не прочитает и VoiceOver — стоит посмотреть отдельно;
- гостевые `guest-browse` / `guest-login-return` пока iOS-only просто
  потому, что не переносились в этом батче, а не из-за платформы.

Кроссплатформенные флоу объявляют `appId: ${APP_ID}` — `run.sh` передаёт
`com.dibird.app.dev` для iOS и `com.dibird.app` для Android. Общие шаги
лежат в `.maestro/common/`: `connect.yaml` (подключение к Metro),
`bootstrap.yaml` (connect + логин при необходимости + возврат на
MainScreen), `credential-entry.yaml`, `back.yaml` (`back` против
`BackButton`). Ссылки внутри `common/` — по имени файла без префикса
`common/`: Maestro резолвит `runFlow` относительно самого файла.

Перед полным батчем состояние стоит сбрасывать: флоу проверяют счётчики
(«в дневнике 1 наблюдение», «мест стало больше»), а каждое падение
оставляет за собой недосозданные записи — следующий прогон стартует с
испорченного тестового аккаунта, и в отчёте появляются падения соседних
флоу, к настоящей причине отношения не имеющие. Сброс — `bash
.maestro/reset-state.sh` (или `--reset`/`RESET=1` у `npm run e2e:android`):
чистит `Observation`/`Diary`/`Place` тестового аккаунта на локальном бэке
(`docker compose exec web python manage.py shell` в `dibird_local`) и делает
`adb shell pm clear com.dibird.app`. По умолчанию выключен — `pm clear`
стоит лишнего логина в bootstrap, а при отладке одного флоу накопленный
аккаунт часто как раз нужен. Онбординг после `pm clear` не всплывает:
`isOnboardingPending()` без ключа `onboarding_pending` отдаёт false, а
ставит его только регистрация.

Поэтому `onboarding.yaml` начинает поток отладочной строкой «Replay
onboarding» в настройках — она спрятана за гейтом по id профиля в
`screens/SettingsScreen.tsx`, где перечислены оба e2e-аккаунта. Флоу
оставляет за собой одно наблюдение (шаг 5 — это и есть создание первой
записи; вид выбирается из данных бэка, и удалять его отсюда нечем).
Незавершённый прогон опаснее: `restart()` пишет флаг на диск, и после
падения в середине `Onboarding` становится корнем стека для каждого
следующего флоу — до MainScreen они бы не добрались вовсе. Гасит это
`common/bootstrap.yaml`: на входе он закрывает оставшийся поток
(«Пропустить», а на экране успеха — «Готово»).

Android-батч гоняет флоу **по одному** (`maestro test` на каждый файл),
сбрасывая airplane mode перед каждым: `toggleAirplaneMode` умеет только
переключать текущее состояние, поэтому упавший в офлайн-фазе флоу раньше
утаскивал за собой следующий — тот тратил свой «уйти в офлайн» на возврат
в онлайн и падал на проверках pending-иконок. Итог печатается в конце
списком (`FAILED flows: ...`), выход — ненулевой, если упал хоть один.

Четыре Android-флоу и iOS-флоу выше — `offline-nested-observation-in-diary.yaml`,
`offline-observation-with-offline-place.yaml`, `offline-alert-settings.yaml`,
`online-create-place-location-denied.yaml`, и update/delete в
`create-observation.yaml` — добавлены в этом батче (см. §7) и написаны по
образцу уже проверенных флоу того же файла; прогнаны на реальном
эмуляторе/симуляторе (2026-07-19, iOS 2/2, Android 10/10, все зелёные с
первого раза, без правок селекторов).

Оба скрипта — обёртка `.maestro/run.sh`: сами находят booted-симулятор
(iOS) или подключённый emulator/device (Android, включая автопоиск `adb`
в стандартных путях SDK) и подставляют явный `--device`, поэтому больше не
нужно вручную выяснять UDID (см. историю в git blame `.maestro/run.sh`,
если понадобятся детали того бага).

Явный `--device` при этом **не** спасает от зависания Maestro на поиске
Android-устройства: сканирование идёт раньше, чем читается `--device`, и
одинаково вешает и iOS-прогон. Maestro сам стучится во все порты
5555..5683 на localhost и ждёт adb-хендшейка без таймаута, так что любой
чужой слушатель в этом диапазоне вешает `npm run e2e` навсегда, не
напечатав ни строки. Из-за этого Flower в бэкендовом
`docker/dibird_local/docker-compose.yml` переехал на хост-порт 15555
(`http://localhost:15555`), а `run.sh` перед стартом проверяет диапазон и
падает с внятной ошибкой, если порт занял кто-то ещё. Credentials берутся из
`.maestro/.env.local` (gitignored, `TEST_EMAIL`/`TEST_PASSWORD`) — файл
нужно завести локально перед первым запуском.

Требования к устройству:
- iOS: booted-симулятор с установленным dev-client билдом (`com.dibird.app.dev`).
- Android: запущенный emulator/device с установленным dev-client билдом
  (`com.dibird.app`) и запущенным Metro. К Metro флоу подключаются через
  `localhost:8081` на обеих платформах — на Android `run.sh` сам делает
  `adb reverse tcp:8081 tcp:8081`, а Simulator делит сетевой стек с
  хостом, — поэтому LAN IP хоста в `.maestro/` больше не прописан
  нигде и при смене сети править флоу не надо (LAN IP остаётся только в `EXPO_PUBLIC_BASE_URL`
  из `.env.development.local` — это адрес API, и именно его должен
  обрубать airplane mode). Loopback переживает `toggleAirplaneMode`, так
  что перезагрузка бандла в офлайне больше не роняет приложение на экран
  dev-client'а «There was a problem loading the project».

Офлайн-синхронизация на iOS (Simulator не умеет переключать airplane
mode на уровне ОС) и push всё ещё не автоматизированы; см. раздел 6.

### Эмулятор и сеть: чего от него ожидать

Три вещи, каждая из которых уже съедала по заходу отладки. Прежде чем чинить
офлайн-флоу, проверять именно их — иначе среда выглядит как регрессия в
приложении.

- **Wifi на эмуляторе держать выключенным, изоляция — только авиарежимом
  поверх мобильных данных.** Соблазн «вылечить» отсутствие сети строкой
  `svc wifi enable` в `.maestro/run.sh` — ловушка: явно включённый wifi
  переживает авиарежим (`airplane_mode_toggleable_radios` по умолчанию
  содержит wifi), и офлайн-флоу начинают молча тестировать пустоту —
  зелёные там, где должны быть красные. Ровно на этом раньше ломались все
  восемь `offline-*` разом: `toggleAirplaneMode` выставлял
  `airplane_mode_on=1`, а wlan0 оставался поднятым, запись синкалась сразу
  и pending-иконка не появлялась.
- **`ping`/`nc` из adb shell ничего не доказывает про приложение.** Airplane
  mode режет сетевой стек приложениям, но не shell. Судить только по
  поведению самого приложения (или по `.maestro/.logs/<flow>.logcat`).
- **Airplane-цикл убивает HTTP-стек приложения на весь срок жизни
  процесса** (проверено 2026-08-16 на Pixel_9_Pro, wifi off). После
  возврата сети запросы умирают по 10-секундному таймауту из
  `services/api.ts` — и через 21 с после реконнекта, и через 60 с, и на
  второй попытке; перезапуск приложения лечит мгновенно. **На реальном
  телефоне не воспроизводится** — там после снятия авиарежима всё работает,
  так что это артефакт эмулятора, а не баг приложения, и трогать сетевой
  слой не надо. Логаут ни при чём: `logout → login` без единого
  переключения сети проходит в одном процессе.

  Всплывает это ровно в одном месте, потому что **ни один другой офлайн-флоу
  не делает после реконнекта настоящий серверный раунд-трип** — они
  возвращаются онлайн и проверяют локальный UI.
  `offline-diary-survives-relogin.yaml` единственный, кому нужен POST, и он
  поэтому перезапускает приложение (`common/connect.yaml`) между
  реконнектом и входом. Если такой флоу появится ещё — делать так же, а не
  искать проблему в приложении.

### Практика прогонов

```bash
npm run e2e:android -- .maestro/<flow>.yaml          # один флоу
npm run e2e:android                                   # весь Android-батч
npm run e2e:android -- --reset .maestro/<flow>.yaml   # со сбросом состояния
```

- `--reset` (`.maestro/reset-state.sh`) чистит данные тестового аккаунта на
  локальном бэкенде **и** делает `pm clear`. Полезно перед батчем,
  разрушительно при отладке одного флоу — там накопленный аккаунт часто
  как раз и нужен.
- Флоу гоняются в алфавитном порядке имён файлов и **переиспользуют
  сессию**; каждый обязан обнулять свои данные сам.
- `DEADLINE_EXCEEDED` в Android-прогоне — залипший эмулятор, а не
  регрессия; каскадит на весь батч, лечится перезапуском эмулятора.
- Прерванный прогон оставляет мусор на аккаунте, и тогда count-ассерты
  соседних флоу врут. Проверять можно через API:
  `GET /myapi/diary2/?per_page=50` с токеном из `/api-auth/login/`.

### Инструменты отладки флоу

Собрано после захода, где разбор двух флоу занял часы: почти всё это время
ушло на вопросы, у которых есть мгновенный ответ.

- **`.maestro/ui.sh`** — что на экране *сейчас*, в виде селекторов: `id`,
  тексты, accessibility-подписи, в порядке чтения экрана, с пометкой
  `OFFSCREEN`. Обёртка над `maestro hierarchy` (сырой JSON — ~50 КБ на
  обычный экран, почти весь системный шум). `--all` оставляет системный UI,
  `--raw` отдаёт исходный JSON.
- **`npm run e2e:ids`** — какие `testID` вообще есть в коде. На Android
  `testID` кладётся в `resource-id`, и именно с ним сопоставляется селектор
  `id:` — то есть список исчерпывающий. Часть id собирается из шаблонов
  (`section-${sec.key}` → `section-*`, RadioGroup даёт `sort-option-N` из
  `testID="sort"`), скрипт печатает и такие заготовки.
- **`npm run e2e:lint`** — сверяет все `id:` во флоу с этим списком и
  парсит YAML. Ловит опечатку в селекторе за 0.1 с вместо ~90 с прогона.
  `-- --syntax` дополнительно гоняет `maestro check-syntax` (по JVM на файл,
  ~1.8 с каждый — потому и не по умолчанию).
- **`npm run e2e:scratch -- <имя>`** — одноразовый флоу из
  `.maestro/scratch/` (gitignored, в батч не попадает). Флоу без `launchApp`
  стартует из текущего состояния приложения: проверка одного шага стоит
  секунды, а не полтора бутстрапа.
- **`.maestro/.logs/<flow>.logcat`** — лог самого приложения, `run.sh`
  пишет его при падении Android-флоу. Разбор надо начинать отсюда: там
  причина (`[AUTH API ERROR] {"code": "TIMEOUT"}`), а Maestro показывает
  только симптом («шаг красный»).
- **`.mcp.json`** подключает `maestro mcp` — device-команды Maestro как
  MCP-инструменты, то есть иерархия/тап/ассерт без цикла «написать флоу →
  прогнать → упасть на селекторе».

Два факта из документации Maestro, на которых ловятся оба типичных падения:

- **`tapOn` не скроллит.** Элемент за пределами экрана — это «element not
  found», неотличимое от опечатки в id. Нужен `scrollUntilVisible`
  (`element:` + `direction: DOWN`), он же no-op, когда элемент уже виден.
  Сетка секций на MainScreen уехала вниз целиком, включая первый ряд, —
  флоу, тапающие `section-*` без скролла, держатся на удаче.
- **Ожидания.** `waitForAnimationToEnd` ждёт, пока перестанет меняться
  картинка, и ничего не знает о сети; ожидание данных — это
  `extendedWaitUntil` с явным `timeout`.

## 2. Авторизация и онбординг

Основано на: `screens/WelcomeScreen.tsx`, `util/auth.ts` (Login/CreateUser/
Logout/LoginWithGoogle/LoginWithApple — `services/authService.ts` — это
только маленький token-update callback registry, не сама auth-логика),
`services/api.ts` (interceptors), `store/auth-context.tsx`,
`hooks/useBiometricSetting.ts`, `services/bio.ts`.

Автоматизировано (`.maestro/login.yaml`, iOS, ручной прогон): email/
password логин — сначала заведомо неверный пароль (проверяет, что
попытка реально отправляется и отклоняется, а не просто исчезает
Welcome-экран), затем настоящие креды → посадка на MainScreen. Остальные
флоу переиспользуют уже сохранённую в Keychain/сессии авторизацию вместо
повторного прогона логина (`common/bootstrap.yaml` вводит креды, только
если сессии нет).

Логаут — `.maestro/logout.yaml` (обе платформы): бургер → «Logout» →
подтверждение в шторке → посадка на Welcome, затем перезапуск приложения,
который проверяет, что токен действительно стёрт из Keychain, а не забыт
процессом. В конце флоу логинится обратно, чтобы следующему в батче
досталась сессия.

Онбординг по-прежнему не автоматизирован: флаг `onboarding_pending`
ставит только регистрация, а вернуть поток на существующем аккаунте умеет
лишь скрытая строка «Replay onboarding» в Settings — она под гейтом
`profile.user === APP_REVIEW_PROFILE_ID || === 1`, а тестовый аккаунт
(`TEST_EMAIL`) имеет `user = 8251`. Либо гонять этот флоу отдельными
кредами ревью-аккаунта, либо оставлять ручным пунктом; расширять гейт
ради теста не стали.

Гостевая воронка — два флоу (iOS, ручной прогон):
`guest-browse.yaml` — запуск без логина → каталог → поиск вида → страница
птицы → «отметить увиденным» → шторка авторизации → отмена (гость остаётся
на птице). `guest-login-return.yaml` — та же дорога до шторки, затем вход
существующими кредами через экран Login (самый длинный путь: к моменту
прихода токена исходного экрана в стеке уже нет) и проверка, что редактор
наблюдения открылся сам, вид в нём подписан, «назад» ведёт на птицу, а
следующее «назад» — на Main.

Автоматизировано юнит-тестами (`npm run test`, часть обязательного
гейта из раздела 1):
- `util/__tests__/auth.test.ts` — `Login`/`CreateUser` (payload,
  `saveTokens`, аналитика); `Logout` целиком, включая то, что каждый из
  трёх независимых `catch` внутри `finally` (POST `/logout/`,
  `GoogleSignin.signOut`, `clearTokens`) не блокирует остальные и
  `AsyncStorage.multiRemove(["profile","filters","sorting","global"])` и
  callback всё равно выполняются; `LoginWithGoogle`/`LoginWithApple` —
  ветки отсутствия токенов, `hasPlayServices`-фейл, `is_new_user` →
  `sign_up` vs `login` аналитика.
- `services/__tests__/api.test.ts` — request-интерсептор (языковой
  префикс, публичные endpoints без `Authorization`) и response-401-ветка
  целиком: ретрай без похода в refresh если токен уже обновился другим
  запросом, single-flight refresh на конкурентных 401, успешный
  refresh+ретрай, сетевая ошибка refresh не форсит логаут,
  `/token/refresh/`/`/logout/` не попадают под 401-ретрай.
- `services/__tests__/bio.test.ts` — `canUseBiometrics`/
  `shouldUseBiometrics` целиком, включая ветку "App Store review sandbox".

Автоматизировано юнит-тестами уровня экрана
(`screens/__tests__/WelcomeScreen.test.tsx`): видимость кнопки Apple по
платформе/`isAvailableAsync()`; тап по Google/Apple вызывает нужный метод и
блокирует повторный тап во время запроса; ошибка показывает toast, но не
на коде отмены пользователем (`SIGN_IN_CANCELLED`/`ERR_REQUEST_CANCELED`);
переходы на Login/Terms/Privacy.

Остаётся ручной проверкой (нативные SDK/UI, которые юнит-тестами не
покрыть):
- [ ] Вход через Google (`GoogleSignin`) и через Apple
      (`expo-apple-authentication`, только iOS, за `isAvailableAsync()`) —
      сам системный диалог, оба варианта на чистой установке (логика
      запроса/сохранения токенов и вся оркестрация экрана уже покрыты
      `auth.test.ts` + `WelcomeScreen.test.tsx`).
- [ ] **Регистрация гостя по почте с возвратом на прерванный экран.** Гость
      на странице птицы → «отметить увиденным» → шторка → «продолжить по
      почте» → Signup новым адресом → CheckEmail → **выгрузить приложение из
      переключателя** → открыть ссылку из письма (деп-линк
      `accounts/confirm-email/:key`) → после входа приложение садится на ту же
      птицу с открытым редактором, «назад» ведёт на Main. Это единственный
      путь, ради которого `services/authReturn.ts` пишет намерение на диск
      (TTL сутки), и e2e он не покрывается: Maestro нужен уникальный адрес на
      каждый прогон и доступ к почтовому ящику. Юнит-тесты покрывают сам
      персист и восстановление, но не связку с реальным письмом.
- [ ] **Разрешения не просятся на старте.** Чистая установка → регистрация →
      системных диалогов гео и пушей быть не должно; оба всплывают только на
      карточке алертов, в настройках алертов, в редакторе места или при
      сортировке по расстоянию. У аккаунта, где разрешение уже выдано,
      координаты по-прежнему подтягиваются молча (`lat`/`lon` в настройках
      алертов не теряются).
- [ ] **Онбординг нового аккаунта.** Чистая установка → регистрация → два
      экрана ценности → страна (под дропдауном появляется «0 из N видов») →
      тап по птице в списке «кого видели рядом» → экран успеха → «Готово» →
      Main с единицей в лайфлисте и наполненным чеклистом. Затем: перезапуск
      приложения — онбординг **не** повторяется; убийство процесса на втором
      шаге — онбординг открывается с начала, а не поверх дашборда; вход гостя
      из каталога (сценарий выше) — онбординга нет ни сразу, ни после
      перезапуска. E2E не покрывается по той же причине, что и регистрация по
      почте: онбординг живёт только на пути нового аккаунта. Логика шагов и
      гейта покрыта `screens/__tests__/OnboardingScreen.test.tsx`,
      `store/__tests__/onboarding-context.test.tsx`,
      `components/Onboarding/__tests__/` и
      `navigation/__tests__/Navigation.test.tsx`.
- [ ] **Онбординг не достаётся существующему аккаунту.** Чистая установка →
      **вход** в аккаунт с историей (не регистрация) → сразу Main, никакого
      «выберите страну». Это главный сценарий смены устройства и переустановки:
      гейт стоит на флаге `onboarding_pending`, который ставят только три точки
      `sign_up` в `util/auth.ts`, — но проверять надо на устройстве, потому что
      цена ошибки здесь «ветеран с 500 наблюдениями отмечает первый вид».
- [ ] **Шаг «первое наблюдение» без сети.** Дойти до четвёртого шага в
      авиарежиме: вместо списков видно объяснение и работающая кнопка
      «Готово» (не только «Пропустить») — отказ сети не должен попадать в
      `onboarding_skipped` наравне с отказом человека.
- [ ] **Импорт из eBird.** Настройки → «Импорт данных» → выбрать реальный CSV
      из «Download My Data». Проверить: отчёт сходится с числом строк в файле;
      **повторная загрузка того же файла не создаёт дублей**; наблюдения видны
      в лайфлисте и статистике сразу (без перезапуска приложения) и остаются
      видны в авиарежиме — это и проверяет сброс офлайн-зеркала; со
      **включённым** свитчем записи появляются в ленте сообщества у второго
      аккаунта, с выключенным — нет; уход с экрана во время импорта и возврат
      подхватывает тот же прогресс, а не начинает заново.
- [ ] **Celery перезапущен на проде.** `import_ebird_csv` — новая задача:
      воркер, поднятый до деплоя, о ней не знает и отвергнет её как
      unregistered. Проверить в flower, что задача есть в списке
      зарегистрированных.
- [ ] Первый вход нового пользователя (`is_new_user`) не путается с
      повторным логином — экран не дублирует онбординг. Уточнение
      (2026-07-19): `is_new_user` — флаг только Google/Apple социального
      логина (`app/myapi/adapters.py:41-43` на бэкенде), у email/password
      логина в ответе его нет вовсе — это подпункт Google/Apple Sign-In
      выше, не отдельный сценарий.
- [ ] Face ID/Touch ID: включить `biometric_enabled`, перезапустить
      приложение — `restoreToken` требует `LocalAuthentication` перед
      восстановлением токена. Сам системный prompt и его отмену
      (`res.success === false`) — только на устройстве/симуляторе
      (гейтинг-логика `canUseBiometrics`/`shouldUseBiometrics` уже
      покрыта `bio.test.ts`). Проверено (2026-07-19): не автоматизируемо
      через `xcrun simctl` — нет CLI subcommand для Face ID enrollment
      (только GUI-меню Simulator.app), обход через AppleScript упирается в
      отсутствие Accessibility-разрешений. Остаётся ручным.

## 3. Офлайн-синхронизация (ключевой риск)

Основано на: `hooks/{Diary,Observation,Place,Notification}Sync.ts` (все —
зеркальные копии одного паттерна), `services/sync/*.ts`,
`hooks/repositories/{diary,observation,place}Repository.ts` (mutation
queue), `components/Profile/FailedEditBanner.tsx`.

Автоматизировано на уровне бизнес-логики (`npm run test`,
`hooks/repositories/__tests__/*Repository.test.ts`, реальная sqlite):
пометка мутации `status:"error"`, `retryMutation`/`discardMutation`
(очистка ошибки, удаление queue-записи и entity-записи), резолв temp-id
у ещё не засинканной записи (`resolveDiaryId`/`resolvePlaceId`) —
включая кейс, когда родитель уже discard-нут (резолвится в `undefined`).

Автоматизировано на уровне устройства, **Android-only**
(`.maestro/offline-create-{diary,observation,place}.yaml`, реальный
OS-level `toggleAirplaneMode`, полный цикл create → update → delete):

- [x] Создать Observation/Diary/Place **в авиарежиме** → запись появляется
      в списке сразу с иконкой "pending" — покрыто Maestro.
- [x] Включить сеть обратно → синхронизация стартует автоматически,
      pending-иконка пропадает, запись получает настоящий id с сервера —
      покрыто Maestro.

- [x] Запись, созданная офлайн, переживает логаут и повторный вход тем же
      аккаунтом — `.maestro/offline-diary-survives-relogin.yaml` (новый,
      прогнан на устройстве 2026-08-15, зелёный). Ветка, которую он проверяет, —
      сравнение `profile.user` с `lastLoggedInUserId` в
      `store/profile-context.tsx`: ошибка в сторону «тот же пользователь»
      молча стирает несинхронизированную работу. Само решение покрыто
      юнит-тестами (`profile-context.test.tsx`, «account switch
      detection»), но не то, что строка действительно осталась в sqlite и
      потом дошла до сервера — флоу проверяет это по счётчику дневников
      (baseline+1 после релогина). Зеркальный случай (вход **другим**
      аккаунтом стирает всё) не автоматизирован: нужен третий набор
      кредов, а две пары в `.maestro/.env.local` — по одной на платформу
      именно ради параллельного прогона.
- [x] Осиротевшее наблюдение: родительский Diary удалён до синка →
      дочерняя мутация падает с понятной ошибкой, а не исчезает —
      `.maestro/offline-orphaned-observation-fails.yaml` (новый, прогнан на
      устройстве 2026-08-15: красный на последнем шаге, и по делу — нашёл
      баг, из-за которого discard упавшей мутации не обновлял список
      (`ObservationDetailScreen`/`DiaryDetailScreen` дёргали только
      `refetch()` одиночного item-запроса, без `invalidateObservationCaches`/
      `invalidateDiaryCaches`; запись оставалась в списке с error-бейджем и
      переживала перезапуск, т.к. результат персистится). Исправлено, юнит-
      тесты на обе кнопки банера добавлены в
      `screens/__tests__/{Observation,Diary}DetailScreen.test.tsx`; флоу
      перепрогнан 2026-08-16 после фикса и зелёный целиком).
      Решение сходиться в ошибку покрыто
      `observationSync.test.ts`; без покрытия оставалось то, что видит
      пользователь: error-бейдж в списке и `FailedEditBanner` с текстом
      «Parent diary could not be synced». Заодно это единственный
      автотест, доходящий до retry/discard банера через настоящую упавшую
      мутацию, а не мок — фейковый бэкенд не нужен, отказ принимается на
      клиенте.

Остаётся ручной проверкой:

- [ ] iOS: тот же offline-цикл (create в авиарежиме → pending-иконка →
      реконнект → синк) — Maestro не может переключать авиарежим на
      симуляторе, аналога `offline-create-*.yaml` для iOS нет.
- [x] `PlaceEditorScreen`, созданный офлайн и использованный в
      Observation (а не в Diary), аналогично резолвится через
      `placeRepository.resolvePlaceId` — покрыто Maestro:
      `.maestro/offline-observation-with-offline-place.yaml` (новый,
      прогнан на устройстве — см. §1, зелёный). Проверяет и локальный join
      (`place_data.name` виден на только что созданном офлайн Observation),
      и резолюцию после реконнекта — `placeSync.ts`'s `runObservationSync()`
      каскадом будит очередь Observation сразу после успешного синка
      Place, не дожидаясь его собственного backoff.

Автоматизировано в этом батче (см. §7 за деталями, включая пометку "нужен
ручной прогон на устройстве" для новых Maestro-флоу):
- [x] Свернуть приложение в фон на >10 сек с pending-записью и вернуть на
      передний план → синк повторно триггерится — это утверждение из
      предыдущей версии документа оказалось **устаревшим при написании**,
      не при разборе только что: `hooks/__tests__/syncHooks.test.tsx` уже
      покрывал этот сценарий table-driven для всех четырёх
      `use*Sync.ts`-хуков до начала этого батча — просто чек-лист не был
      обновлён вслед за тестом. Тот же случай ниже для discard/syncBatch/
      inFlight/backoff.
- [x] Смоделировать ошибку не-сетевого типа (400) → `status:"error"` +
      `FailedEditBanner` с retry/discard — как и выше, `FailedEditBanner.test.tsx`
      уже существовал и полностью покрывал retry/discard до этого батча;
      реальный 400 от бэкенда на устройстве остаётся ручным пунктом (это
      никогда не было задачей для автотеста).
- [x] Родительский Diary отменили (discard) до синка → дочерняя мутация
      фейлится с понятной ошибкой — уже было покрыто
      `observationSync.test.ts`'s "fails outright a mutation whose parent
      diary was discarded before it ever synced" до этого батча.
- [x] Создать Observation внутри ещё не засинканного офлайн Diary (temp
      id) → после синка родительского Diary дочернее Observation
      корректно переразрешает `diary` id — резолв id уже был покрыт
      repository-тестами; сквозной UI-сценарий теперь тоже —
      `.maestro/offline-nested-observation-in-diary.yaml` (новый в этом
      батче, требует один ручной прогон на устройстве — см. §1).

## 4. Создание наблюдения/дневника/места — основной пользовательский путь

Основано на: `screens/{Observation,Diary}EditorScreen.tsx`,
`hooks/useEditorForm.ts`, `components/ui/SpeciesDropdown.tsx`,
`hooks/Place/usePlaceLocation.ts`, `hooks/Observation/useOfflineObservation.ts`.

Автоматизировано:
- [x] Онлайн create → update → delete: Observation/Diary/Place на Android
      (`online-create-{diary,observation,place}.yaml`) и создание
      Observation на iOS (`create-observation.yaml`) — реальные
      round-trip'ы на бэкенд, включая выбор вида через `SpeciesDropdown`
      и подтверждение по count-based delete проверке.
- [x] Полный офлайн create → update → delete на Android
      (`offline-create-{diary,observation,place}.yaml`, см. раздел 3).
- [x] `screens/__tests__/ObservationEditorScreen.test.tsx` — оркестрация
      экрана юнит-тестами: create/edit режим (правильные параметры в
      `useEditorForm`, заголовок), блокировка сохранения при невалидной
      форме или отсутствующих обязательных значениях, ветвление навигации
      после сохранения (`returnMode: "back"` vs `replace` на
      ObservationDetail vs update → `goBack`), маппинг серверной ошибки на
      конкретное поле формы vs fallback-toast, "save and add another" в
      diary-режиме (сброс полей, инвалидация `DiarySpecies`), регистрация
      nav-callback при добавлении нового места, игнор повторного тапа на
      кнопку сохранения во время pending-мутации.

Автоматизировано в этом батче (см. §7):
- [x] iOS: update/delete записи — `create-observation.yaml` расширен до
      полного create → update → delete цикла, тем же паттерном что и
      Android (требует один ручной прогон на устройстве — см. §1).
- [x] `DateInput`'s реальный Android date-picker (`@react-native-community/
      datetimepicker`'s нативный `DatePickerDialog`, вне RN-дерева — юнит-
      тест `DateInput.test.tsx` полностью мокает эту библиотеку, так что
      это единственное место, где виджет вообще проверяется) —
      `.maestro/online-create-observation.yaml`, прогнан на устройстве
      2026-07-19, зелёный с первого раза. Потребовал новый опциональный
      `testID` на `DateInput`'s триггере (`components/ui/DateInput.tsx`,
      вайрится только из `ObservationForm.tsx` — два `DateInput` в
      `DateRangeFilter.tsx` не тронуты). Остальные опциональные поля формы
      (quantity/notes/name) сознательно не добавлены в e2e — их payload-
      логика уже полностью покрыта `ObservationForm.test.tsx`/
      `DiaryForm.test.tsx`, а сами виджеты (обычный `TextInput`) не несут
      того риска нативного стороннего компонента, который есть у date-picker.
- [x] `SpeciesDropdown`: реальный 24ч TTL кэша (`useDropdownQuery`) —
      `hooks/__tests__/useDropdownQuery.test.tsx`'s новый блок "24h
      staleTime" (мокает `Date.now`, не `jest.useFakeTimers`, чтобы не
      мешать `waitFor`'s собственному polling) — как отсутствие рефетча
      на <24ч, так и рефетч на >24ч.
- [x] Разрешение геолокации: явно отклонить permission на устройстве и
      убедиться, что ручной ввод координат/выбор на карте всё ещё
      работает (`usePlaceLocation`'s `normalizeCoords`), а не блокирует
      экран целиком — `.maestro/online-create-place-location-denied.yaml`
      (новый, `launchApp: permissions: location: deny`, требует один
      ручной прогон на устройстве — см. §1).

Явно **не проверяем**: прикрепление фото к Observation/Diary — такого
поля нет в `EditorFormData`/`ObservationForm`/`DiaryForm` (фото есть
только у аватара профиля, `components/Profile/Avatar.tsx`, это отдельный
поток — см. раздел 5 профиля при необходимости).

## 5. Уведомления и алерты (Maestro-флоу нет — юнит-тесты + ручная проверка)

Основано на: `hooks/usePushNotifications.ts`,
`screens/AlertSettingsScreen.tsx`, `services/alertSettings.ts`,
`hooks/repositories/alertSettingsRepository.ts`, `hooks/useUnreadCount.ts`,
`screens/NotificationsScreen.tsx`, `services/sync/alertSettingsSync.ts`,
`store/alert-settings-context.tsx`.

Автоматизировано юнит-тестами (`npm run test`):
- `hooks/__tests__/usePushNotifications.test.ts` — permission denied
  останавливается до похода за токеном; успешная регистрация
  (`registerPushToken`); сетевая ошибка регистрации → подписка на
  reconnect и ретрай ровно один раз, затем отписка; `handleNotificationNavigation`
  — все 4 маршрута (`Community`/`SpeciesDetail`/`Achievements`/`Checklist`);
  снятие обоих notification-листенеров и reconnect-подписки при unmount.
- `hooks/__tests__/useUnreadCount.test.ts` — конфигурация `useQuery`
  (ключ/фетчер/2-мин polling); офлайн-пометка "прочитано" + синк — через
  `notificationSync.test.ts` (`markAll`/`markIds`, sentinel id `-1`).
- `services/sync/__tests__/alertSettingsSync.test.ts` +
  `store/__tests__/alert-settings-context.test.tsx` — раньше был
  единственным непокрытым sync-движком из шести; теперь push/pull целиком
  и reconnect/foreground-триггер (аналог уже покрытого
  `profile-context.test.tsx`) тоже под тестами.
- `screens/__tests__/NotificationsScreen.test.tsx` — loading/empty state;
  mark-all-read (двойная инвалидация); тап по непрочитанному помечает+
  инвалидирует, по уже прочитанному — no-op; вся таблица роутинга по тапу
  (`Community`/`CommunityDetail`/`SpeciesDetail`/`Achievements`/`Checklist`
  + неизвестный тип — no-op); `onEndReached`-пагинация.
- `screens/__tests__/AlertSettingsScreen.test.tsx` — loading/error-гейт
  (с сохранением кэша при ошибке-но-есть-данные); все `save()` call-sites
  (enable-свитч, watchlist/seen_mode, radius, стрелки max_alerts_per_day,
  окна расписания add/edit/remove); **отдельно** денай геолокации: экран
  показывает bottom-sheet вместо крэша и не идёт в `requestLocation` —
  закрывает пункт, явно названный в чек-листе.

Остаётся ручной проверкой (реальное устройство/системные диалоги):
- [ ] Разрешение на push-уведомления: первый вход → системный запрос →
      `Notifications.getExpoPushTokenAsync()` → токен реально
      регистрируется на бэкенде (сам системный диалог и реальный
      push-токен — логика регистрации/ретрая уже покрыта юнит-тестом).
- [ ] Тап по реальному push-уведомлению с устройства открывает нужный
      экран (маршрутизация уже покрыта юнит-тестами на двух уровнях —
      `usePushNotifications.test.ts` и `NotificationsScreen.test.tsx`, но
      не факт что реальный payload от бэкенда доходит и парсится как
      ожидается).
- [x] `AlertSettingsScreen`: включить алерты с геолокацией → отклонить
      разрешение на локацию → экран показывает понятное состояние, а не
      крашится — теперь юнит-тест, не только ручная проверка.
- [x] Изменения настроек алертов, сделанные офлайн, реально
      синхронизируются при восстановлении сети — сама sync-логика и
      reconnect/foreground-триггер уже были покрыты юнит-тестами, теперь
      и сквозной UI-сценарий — `.maestro/offline-alert-settings.yaml`
      (новый в этом батче; проверяет через force-quit+relaunch, а не
      просто уход с экрана и назад, поскольку `AlertSettingsProvider` —
      общий на всё приложение инстанс, и осталось бы показывать
      локальное состояние независимо от того, дошёл ли реальный запрос
      до сервера; требует один ручной прогон на устройстве — см. §1).
      Потребовал два новых `testID` в продакшен-коде, ни один элемент
      раньше не был доступен для Maestro: `RowSwitch`'s `Switch`
      (`alert-enabled-switch`, тот же опциональный `testID`-проп что уже
      был у `PrivacyToggle`/`IconButton`) и `FloatingHeader`'s
      `BurgerButton` (`burger-menu-button`, раньше вообще без
      accessibility-текста или testID — не было способа открыть drawer
      из Maestro).

## 6. Что дальше (осознанно не входит в этот релизный гейт)

Платформенно/инфраструктурно заблокированное — не задача тестирования,
ждёт либо возможностей платформы, либо CI-инфраструктуры:

- iOS-офлайн (раздел 3) и push-уведомления (раздел 5) осознанно не
  автоматизированы в Maestro — `toggleAirplaneMode` недоступен на iOS
  Simulator (нет radio-стека), а push требует управления инфраструктурой
  пуш-сервиса; надёжность такой автоматизации под вопросом, пока остаются
  ручными пунктами чек-листа.
- `PlaceEditorScreen`, созданный офлайн и связанный с Observation (не с
  Diary — этот случай уже покрыт, см. раздел 3) — не по инфраструктурной
  причине, просто не влезло в этот батч (см. раздел 3).
- CI для e2e (`npm run e2e` / `npm run e2e:android` в GitHub Actions) —
  не сделано: нет CI-раннера с эмулятором/симулятором и собранным
  dev-client билдом. `npm run check` + `npm run test:ci` теперь гоняются
  автоматически в [.github/workflows/ci.yml](.github/workflows/ci.yml) на
  каждый PR в master и на сам master (см. раздел 1) — ручной прогон перед
  релизом остаётся дополнительной подстраховкой, а не единственной линией
  защиты.

### Очередь следующих e2e-флоу

Порядок — по риску потери пользовательских данных. Первые два риска из этого
списка уже закрыты (`offline-diary-survives-relogin.yaml`,
`offline-orphaned-observation-fails.yaml`, см. §3).

1. **Правка профиля офлайн.** `ProfileScreen`/`ProfileForm`/`profileSync` —
   ноль e2e, отдельная очередь мутаций (`entity: "profile"`). Текстовые поля
   и страна автоматизируются просто. Аватар (`avatarSync`,
   `pendingAvatarUri`/`pendingAvatarOp`) — отдельный флоу и отдельный
   разговор: нужен системный image picker, это хрупко.
2. **Уведомления: mark-all-read офлайн.** `notificationRepository` с
   sentinel id `-1` и `applyPendingUnreadAdjustment`. Через force-quit +
   relaunch, а не просто уход с экрана — по той же причине, что и
   `offline-alert-settings.yaml` (провайдер общий на приложение).
3. **Deep links при активной сессии.** Есть только
   `guest-deeplink-no-session`. Состав ссылок брать из
   `linking.deeplinks.test.ts` — это источник истины, не QA-страница бэка.
   Дешёвый флоу на обе платформы.
4. **Импорт наблюдений из CSV.** `screens/ImportScreen.tsx`, async-джоба с
   поллингом. Упирается в `DocumentPicker.getDocumentAsync` — системный UI;
   самый хрупкий кандидат, брать последним или не брать.

Осознанно **не** автоматизируется: зеркальный случай к
`offline-diary-survives-relogin.yaml` — вход **другим** аккаунтом стирает
локальные данные. Нужен третий набор кредов, а две пары в
`.maestro/.env.local` — по одной на платформу ради параллельного прогона.

Разведка обходов платформенных ограничений (не сделана, оценки грубые):

- **Шторки на iOS** (`list-filters`, `list-sort-persist` — сейчас
  Android-only): gorhom схлопывает содержимое в один accessibility-элемент.
  Возможно, лечится `accessible={false}` на контейнере шторки. Самое
  быстрое из списка — полчаса на проверку, и два флоу становятся
  кросс-платформенными.
- **iOS-офлайн** (6 флоу Android-only): `toggleAirplaneMode` на симуляторе
  не существует. Единственный реальный обход — dev-only флаг «форсировать
  офлайн» в `services/sync/networkStatus.ts`. Цена: код в проде ради теста
  и проверка абстракции, а не настоящего сетевого стека.
- **Push**: для iOS есть `xcrun simctl push <udid> com.dibird.app.dev
  payload.json` — доставляет APNs-payload без пуш-инфраструктуры. Не
  проверено, умеет ли Maestro тапнуть по баннеру уведомления на iOS.

### Известные баги, найденные тестами, но сознательно не исправленные

Пусто.

Прежние пункты исправлены — см.
журнал §7 (последние две записи) за подробностями: `ProfileForm.tsx`'s
пропавшая error-подсказка на `DropdownInput`, и `profileRepository.ts`'s
`applyLocalPatch()`/`queuePendingAvatar()`, у которых обоснование
"недостижимо через реальный UI" при повторной проверке оказалось
неполным (реальный путь — форс-логаут, гонящийся с уже открытой формой
профиля).

### Состояние покрытия и что осталось

`npm run test:coverage` после седьмого батча — 92.01% stmts (был 47.3% →
60.39% → 69.0% → 74.23% → 78.16% → 83.21% → 86.88% → 92.01%). После
двенадцатого батча (см. §7) — 91.94% stmts, 1755 тестов, 163 suite; лёгкое
снижение процента не регрессия, а ожидаемое разбавление новым
некритическим кодом (два новых `testID`-пропа) при том же знаменателе
покрытых строк — этот батч не был coverage-driven вообще (см. запись
батча 12 в §7).

Этот батч — не продолжение коверидж-driven списка, а **ревизия самого
списка "не включено намеренно"** ниже: два Explore-агента перечитали
каждый файл из старого списка целиком (не только однострочное
обоснование) и сверили с реальным использованием в тестах. Вывод:
**большая часть обоснований была написана по памяти и не подтвердилась
при чтении кода.** Конкретно опровергнуто:
- `util/sortOptionsList.ts` — заявлялось "пассивно покрыт побочным
  эффектом тестов"; на деле упоминается в ровно одном тесте, и даже там
  замокан целиком. Ни одна из 13 веток switch реально не выполнялась.
- `store/theme-context.tsx`/`language-context.tsx` — заявлялось "конфиг,
  меняется редко"; на деле оба содержат настоящий async
  AsyncStorage-round-trip, ветвление manual-vs-system темы/языка и
  обработку ошибок — ничего из этого не выполнялось (все потребители
  мокали `useTheme`/`useLanguage` целиком).
- `components/Main/*` — заявлялось "чисто презентационные"; на деле 9 из
  13 файлов делают реальные `useQuery`/`useList`-запросы, вычисления и
  `onPress` → `navigation.navigate`. Презентационны только 4
  `*Skeleton.tsx`.
- `components/ui/Layout.tsx` — заявлялось "уже покрыт passthrough-моком
  во всех экранных тестах"; на самом деле наоборот — этот мок как раз
  ОБХОДИТ тройное ветвление (`withKeyboard`/`withScroll`/plain), которое
  и надо было тестировать.
- `components/ui/CustomSplash.tsx` — содержит реальную async-оркестрацию
  (`setTimeout` + `waitFor` + `SplashScreen.hideAsync` + `onFinish`), не
  просто декорацию.
- `services/queryClient.ts` (3-ветвевой retry-предикат) и
  `services/navigationRef.ts` (pending-navigation очередь/flush) —
  заявлялись "тонкие обёртки над SDK", но имеют настоящую логику.
- `util/openSupportEmail.ts` — заявлялось "однострочный wrapper"; на деле
  есть `canOpenURL`-ветка и catch-ветка, обе через общий Toast-хендлер.

Все 17 файлов из этого списка теперь покрыты тестами — см. журнал (§7)
для деталей по батчам 7–11.

Подтверждено, что остаётся легитимно исключённым: `components/ui/
{BackgroundScene2,CustomSplash}.tsx`'s декоративные соседи
(`BackgroundScene2.tsx` — минимальный `useState` для `onLayout`, но без
интерактивности; неиспользуемые `BackgroundScene.tsx`/`BackgroundScene3.tsx`
удалены), 4 `*Skeleton.tsx`-файла в `components/Main/`
(`BirdOfTheDaySceleton`/`ChecklistHeroSkeleton`/`SparklineSkeleton`/
`StatsSkeleton` — чисто статичная разметка), `services/sentry.ts`
(конфиг-объект + один `!__DEV__`-тернарник, не более),
`services/db/client.ts` (глобально замокан в `jest.setup.js`, реальная
логика байпасится целиком), `screens/{AchievementsScreen,
SpeciesDetailScreen}.tsx` (буквально `<Text>ScreenName</Text>`, ноль
хуков).

Оставшиеся кандидаты ниже ~70% stmts, не входившие в этот батч:
`store/profile-context.tsx` (62.76%), `store/alert-settings-context.tsx`
(66.21%), `hooks/useLocationUnavailable.ts` (66.66%),
`services/authService.ts` (66.66%) — все реально используются и
тестируются транзитивно через `useApiError`/`AlertSettingsScreen`/
`PlaceBlock`/`ObservationForm`-тесты и т.п., просто без выделенного файла
на сам модуль; `hooks/useLocationUnavailable.ts` — самый дешёвый следующий
шаг (симметричен уже покрытому `useMediaLibraryUnavailable.ts`). За их
пределами дальнейшее движение разумнее не через stmts-процент, а через
интеграционные/e2e-сценарии из раздела 6 (iOS-офлайн, push, iOS
update/delete), которые вне гейта по инфраструктурным, не тестовым
причинам.

## 7. Журнал закрытых пробелов покрытия (справочно, не влияет на гейт)

Хронология того, что уже сделано сверх раздела 1 — оставлено как
справочный журнал (что покрыто, зачем, какие баги попутно нашлись), не
как чек-лист задач.

- Maestro (20 флоу на 2026-07-29; таблица состава — в разделе 1). Начиналось
  с 8: `login.yaml`/`create-observation.yaml` (iOS) и
  `{offline,online}-create-{diary,observation,place}.yaml` (Android,
  полный create → update → delete цикл, офлайн-версии с реальным
  OS-level airplane mode). Потребовали добавить `testID` в несколько
  ключевых мест (`Input`, `IconButton`/`IconsHeader`, FAB/quick-actions,
  триггеры дропдаунов территории/вида) — в приложении не было ни testID,
  ни accessibilityLabel.
- Repository-слой (`diary`/`observation`/`place`/`alertSettings`/
  `profile`Repository) покрыт jest-тестами поверх реальной sqlite
  (`hooks/repositories/testDb.ts`, checked-in миграции) — входит в
  `npm run test`, сократил долю ручной проверки в разделе 3 (error/retry/
  discard, резолв temp-id). При написании тестов всплыли и **исправлены**
  два однотипных бага в `profileRepository.ts`/`alertSettingsRepository.ts`:
  `resolveMutation()` в обоих файлах помечала запись `"synced"`
  безусловно, не проверяя другие ещё pending-мутации (теперь пересчитывает
  `remaining`, как уже делал `discardMutation()`); `applyLocalPatch()` в
  `alertSettingsRepository.ts` не создавала settings-строку, если её ещё
  не было (голый `UPDATE` без `.where()`/upsert) — заменено на
  `onConflictDoUpdate`. Аналогичный баг в `profileRepository.ts`'s
  `applyLocalPatch()` остался **не исправлен** — см. раздел 6.
- Auth/security (`util/auth.ts`, `services/api.ts`'s 401-refresh
  интерсептор, `services/bio.ts`) и push/alert-sync
  (`usePushNotifications.ts`, `alertSettingsSync.ts` + его
  reconnect/foreground-триггер в `alert-settings-context.tsx`) закрыты
  юнит-тестами — раньше это были модули с нулевым покрытием, теперь входят
  в обязательный гейт раздела 1. При написании `api.test.ts` нашли и
  **исправили** баг: `clearTokens()` сбрасывала `isLoggingOut` в `false`
  первой же строкой, из-за чего guard от повторного форсированного
  логаута не работал — при двух параллельных запросах, оба словивших
  неудачный refresh, `onUnauthorizedCallback` мог вызваться дважды подряд;
  теперь флаг сбрасывается только в `saveTokens()`, на следующем успешном
  логине. Заодно почищены две дыры в самом jest-конфиге, которые вскрылись
  при первом импорте этих модулей в тестах (не относятся к тестируемому
  коду — только к тестовой инфраструктуре): `@react-native-async-storage/
  async-storage` в `setupFiles` только вычислялся, но не подключался как
  замена модуля (нужен явный `jest.mock`, теперь в `auth.test.ts`);
  `react-native-reanimated` 4.x (через `react-native-worklets`) требует
  свой `resolver` в `jest.config.js` — добавлен, чинит любой будущий тест,
  который транзитивно тронет reanimated.
- `screens/**`: раньше 0 файлов на весь каталог и полностью исключён из
  `collectCoverageFrom`. Теперь 28 из 30 экранов (плюс общий shell
  `ListScreen.tsx`, самая широкая поверхность мока в репозитории —
  filters-context/location-context/language-context/BottomSheet,
  переиспользуется 9 экранами: Diaries/Observations/Places/Community/
  Rating/RatingsCompare/Stat/UserStat) покрыты; `collectCoverageFrom`
  включает `screens/**/*.{ts,tsx}`. Первые 5 —
  `WelcomeScreen`/`ProfileScreen`/`AlertSettingsScreen`/
  `NotificationsScreen`/`ObservationEditorScreen` — выбраны как самые
  рискованные по самому этому чек-листу (см. §2/§4/§5 выше); остальные
  дописаны тем же паттерном, включая detail-экраны с owner/non-owner
  ветвлением (`ObservationDetail`/`DiaryDetail`/`PlaceDetail`/
  `CommunityDetail`), stat/checklist-режимы (`StatScreen`) и системные
  настройки с биометрией/экспортом/удалением профиля (`SettingsScreen`).
  Оставшиеся 2 из 30 — `AchievementsScreen.tsx`/`SpeciesDetailScreen.tsx` —
  не покрыты **намеренно**: обе целиком заглушки (`<Text>ScreenName</Text>`,
  ни одного хука/ветвления), фича ещё не реализована — тестировать
  нечего, добавить тест вместе с реализацией.
  Установлены переиспользуемые конвенции для всех экранных тестов:
  `screens/test-utils.tsx` (фабрика мока навигации,
  `useNavigation`/`useRoute`/`getParent`) и `screens/mockTheme.ts`
  (расшаренный `Colors`-мок, ранее дублировался в 2 компонентных тестах) —
  оба лежат **рядом** с `screens/__tests__/`, не внутри (иначе jest
  пытается запускать их как отдельные test suite, см. `testDb.ts`'s
  такое же расположение для repository-тестов). Для `@tanstack/react-query`
  — мокать модуль/кастомный хук, не поднимать `QueryClientProvider`
  (соответствует единственному прежнему прецеденту в репо). Тяжёлые дочерние
  формы/виджеты (`ProfileForm`, `ObservationForm`, `DiaryForm`, `PlaceForm`,
  `RadiusRow`, `TimeWindowRow`, `IconsHeader`, `Tabs`, `StatCard`,
  `ChecklistCard`, `CommunityCard`, `DiaryCard`, `PlacePreviewRow`,
  `Section`, `ProfileAvatar`, `MapL`, `FilterChips`) застаблены —
  тестируется оркестрация экрана, а не чужая вложенная форма. По пути
  найдены и обойдены дыры окружения (не в коде продукта): `RTL v14` убрала
  `UNSAFE_getByType`/`UNSAFE_getByProps` (добавлены `testID` —
  `ItemsList`'s `FlatList`, `LoadingOverlay`, `StaticScreen`'s loader);
  `Pressable`/`IconButton` не всегда уважает `onPress: undefined` при
  disabled под fireEvent.press в этой связке RN/RTL (обойдено стабом
  `IconsHeader`, который также должен фильтровать по `btn.condition`, а не
  только `disabled` — иначе кнопка, скрытая по условию видимости для
  non-owner, ошибочно тестируется как "disabled" вместо "не рендерится");
  реальные `setTimeout`/`requestAnimationFrame` (success-flash таймеры,
  `navigation.replace`-отложки) требуют fake timers, иначе тест оставляет
  висящий таймер; RTL v14's `render`/`fireEvent`/`unmount` асинхронны —
  `unmount()` тоже нужно `await`, иначе cleanup-эффекты
  (`useEffect(() => () => cleanup(), [])`) не успевают сработать до
  assert.
- Пробелы за пределами `screens/**`, найденные через
  `npm run test:coverage` (был 47.3% stmts, стал 60.39%). Порядок
  выбирался по риску, не по объёму: сперва офлайн-мутационные хуки
  (`hooks/{Diary,Observation,Place}/useOffline*.ts` — сам механизм
  create/update/delete "онлайн успех → сеть упала → локальный драфт →
  триггер sync", уже названный ключевым риском в разделе 3), затем
  `hooks/useEditorForm.ts` (общая форм-логика редакторов),
  `util/fetches.ts` (был самым большим непокрытым файлом, ~700 строк —
  общий `fetchAbstract`-кэш-фолбэк плюс уникальные `deriveFallback`/
  `resort` каждого списка), 4 формы (`ObservationForm`/`DiaryForm`/
  `PlaceForm`/`ProfileForm` — валидация и wiring полей, ранее
  проверялись только через мок в экранных тестах), и 3 давно непокрытых
  стор-контекста (`auth-context.tsx` — восстановление токена/биометрия/
  logout, `filters-context.tsx`, `location-context.tsx` — permission-флоу
  и guard от повторного одновременного запроса). `useOffline*`-хуки и
  `useEditorForm` тестируются через настоящий `QueryClient`/
  `QueryClientProvider` (а не мок `@tanstack/react-query`, как в остальном
  репозитории) — сама react-query-оркестрация тут и есть предмет теста;
  репозитории (`diaryRepository`/`observationRepository`/
  `placeRepository`) при этом замоканы целиком, так как уже покрыты
  отдельно. Новая для репозитория деталь тестового окружения: react-query
  batches уведомления через реальный `setTimeout(0)` вне `act()`, что
  даёт зависший таймер и act()-warning — фиксится
  `notifyManager.setScheduler((cb) => cb())` в начале файла. При написании
  тестов на `ProfileForm.tsx` найден баг, оставшийся **не исправлен** —
  см. раздел 6. Итог всей инициативы (`screens/**` + этот батч): 814
  тестов, 71 suite, `npm run test` и `npm run check` зелёные.
- Второй батч пробелов покрытия (60.39% → 69.0% stmts), выбранный по
  тому же принципу риска из предыдущей ревизии раздела 6, в порядке
  выполнения: три оставшихся низкопокрытых repository-модуля
  (`notificationRepository.ts` — offline-пометка "прочитано",
  `listCacheRepository.ts` — общий кэш-фолбэк механизм с LRU-подобным
  вытеснением по `updated_at`, `referenceRepository.ts` — countries/
  timezones справочники), `hooks/useDropdownQuery.ts` (общий движок сорта
  всех 4 форм — distance-sort permission-гейтинг, отложенный sort после
  `requestLocation`), `hooks/Place/usePlaceLocation.ts` (`normalizeCoords`
  + геолокационная логика создания места, риск из §4), `util/storageHelper.ts`
  (save/load для глобальных фильтров), `services/alertSettings.ts`
  (прямая зависимость `AlertSettingsScreen`), `hooks/useApiError.ts`, все
  8 Card-компонентов списков (`ObservationCard`/`DiaryCard`/`PlaceCard`/
  `CommunityCard`/`ChecklistCard`/`components/Stats/StatCard.tsx`/
  `RatingCard`/`RatingCompareCard` — не путать с уже покрытым
  `components/ui/StatCard.tsx`, другим одноимённым файлом), и 4 общих
  поля форм (`Input`/`DateInput`/`TimeInput`/`DropdownInput` —
  используются всеми 4 формами и большинством экранов, раньше везде
  застаблены вместо прямого тестирования). `DateInput`/`TimeInput`
  впервые в репозитории тестируют платформенно-ветвящийся (Android
  inline-picker vs iOS spinner-панель) компонент с `@react-native-community/
  datetimepicker` — сам пикер застаблен целиком (захват `onChange`-пропа,
  вызывается вручную в тесте), поскольку рендерить настоящий нативный
  пикер в jest бессмысленно; `expo-haptics` тоже застаблен. `listCacheRepository`'s
  eviction-тест — единственный во всём наборе, что намеренно вставляет
  22 строки подряд (порог вытеснения = `maxEntries + max(20, round(maxEntries*0.1))`,
  а `MIN_HYSTERESIS=20` доминирует при любом разумном `maxEntries`, так
  что меньше 22 строк порог не перейти). Итог: 1071 тестов, 91 suite,
  `npm run test`, `npm run check` и `npm run test:coverage` (69.0% stmts,
  было 47.3% в начале всей инициативы) зелёные.
- Третий батч (69.0% → 74.23% stmts), четыре пункта из прошлой ревизии
  этого раздела: `components/Auth/{AuthContent,AuthForm}.tsx` (риск §2,
  логин/сигнап валидация — email `@`/пароль `>6`/confirm-match/
  username≠email, trimming, `extractApiError`'s разбор `non_field_errors`/
  `email`/`username`/`password`/fallback-join, connectivity-ветка без
  extractor'а); `components/ui/{IconsHeader,IconButton}.tsx` (порядок
  `headerRightBeginning`/встроенные кнопки/`headerRightEnd`,
  `condition`-фильтрация именно вместо "disabled"-рендера — см. §6);
  `components/ui/{Section,PrivacyToggle,RadiusRow,TimeWindowRow,Tabs}.tsx`
  (collapsible/`collapsed`-без-`collapsible` эджкейс у `Section`,
  `RadiusRow`'s presets+slider wiring, `TimeWindowRow`'s expand/collapse и
  проброс в `HourPicker`, `Tabs`'s 999+ cap и haptic); `hooks/
  useFilterLabels.ts`/`hooks/useSyncedFilters.ts` (риск §4 —
  территория/место/вид резолвятся из dropdown-кэша с фоллбэком на
  placeholder, `formatDateFilter`'s все ветки, deep-link vs
  `filtersOverride` vs context-инициализация, dedup по `lastDeepLinkKeyRef`,
  focus-effect ресинк с контекстом включая сброс place/species при смене
  territory и "stale species" коррекцию, `loadAndApplySort`'s distance-
  fallback когда `locationCoords===null` — не только на denied-permission,
  как можно было бы предположить). Два маленьких прод-фикса по пути:
  `IconButton`'s "active" индикатор и `PrivacyToggle`'s Pressable/Switch не
  имели `testID` вообще — добавлен опциональный `testID`-проп на оба (тот
  же паттерн, что уже был у `Input`/`IconsHeader`). Ещё раз подтверждён тот
  же RN/RTL-баг из §6 (`fireEvent.press` не уважает реальный
  `onPress: undefined` при `disabled` на `Pressable`) — на этот раз в
  выделенном `IconButton.test.tsx`, обойдено проверкой резолвленного
  `.props.onPress` вместо симуляции нажатия; для disabled-состояния самого
  `Pressable` понадобился `.props.accessibilityState.disabled` — RN не
  прокидывает `disabled` как обычный проп на нижележащий host-node. Мок
  `useFocusEffect: (cb) => cb()`, который работает в экранных тестах, в
  выделенном тесте `useSyncedFilters` вызывал "Too many re-renders" (его
  focus-callback дергает `setFilters` во время рендера) — заменён на
  `useEffect(cb, [cb])`, что ближе к реальной семантике (эффект после
  коммита, перезапуск при смене зависимостей `cb`). Итог: 1184 тестов, 102
  suite, `npm run test`, `npm run check` и `npm run test:coverage`
  (74.23% stmts) зелёные.
- Четвёртый батч (74.23% → 78.16% stmts), четыре пункта из прошлой
  ревизии этого раздела: `DropdownInput`'s делегаты — `SpeciesDropdown.tsx`
  (loading/error/thumb/placeholder/пустое состояние, info-кнопка →
  `speciesDetails`, отличие латинского названия от отображаемого),
  `PlaceDropdown.tsx` (превью карты: сразу из `placeData.preview` vs
  `fetchMapPreview`-запрос с `previewLoading`, ошибка запроса логируется и
  не блокирует UI, expand-оверлей → `navigation.navigate("PlaceDetail")`,
  clear-кнопка), `SelectListModal.tsx` (фильтрация с ё→е нормализацией,
  `renderOption` override, шторка сортировки — resync на внешний `sort`,
  disabled-значения дистанции без геолокации → `onLocationUnavailable`);
  `services/errors.ts` (`normalizeApiError`'s все ветки статусов/timeout/
  network, `extractServerMessage`'s `non_field_errors` → первое truthy
  поле → null, `toUIError`'s extractor vs policy-fallback vs
  server-message-приоритет, `showError`'s Toast-вызов, `logError`'s
  `__DEV__`-гейт и error/warn по статусу); `hooks/useBiometricSetting.ts`
  (SecureStore round-trip, optimistic `toggle`); `components/Profile/
  {Avatar,ProfileAvatar,CompareProfileHeader}.tsx` (`Avatar`'s
  `pendingAvatarOp` resolution, permission-цепочка `ImagePicker` (denied →
  unavailable-шторка, undetermined → request → possibly-denied stop),
  полный upload-пайплайн `manipulateAsync` → `copyAsync` в
  `documentDirectory` → `queuePendingAvatar` → `runAvatarSync` →
  invalidate, error → toast; `ProfileAvatar`'s URI-резолв — bare path
  получает `Config.mediaUrl` префикс, `file://`/`http(s)://` используются
  как есть; `CompareProfileHeader`'s `< 2 профилей → null`, навигация на
  Stat vs UserStat по `myProfileId`). По пути добавлен `testID` на
  `PlaceDropdown`'s корневой `Pressable` (`SpeciesDropdown` его уже имел,
  `PlaceDropdown` — нет, понадобился, чтобы не завязываться на
  `fireEvent.press` по тексту loading/error-состояний). Итог: 1279 тестов,
  110 suite, `npm run test`, `npm run check` и `npm run test:coverage`
  (78.16% stmts) зелёные.
- Пятый батч (78.16% → 83.21% stmts), пять пунктов из прошлой ревизии
  этого раздела: `components/Filters/{FilterChips,FilterSheetContent}.tsx`/
  `DateRangeFilter.tsx`/`SortSheetContent.tsx` (allowed-based видимость
  полей, `effectiveTerritory`/`extraTerritory` гейтинг, territory-change
  сбрасывает place/species только НЕ на первом монтировании,
  stale-species коррекция, `applyHandler`'s `getNewFilters`+контекст-пропагация,
  `DateRangeFilter`'s все ветки `handleModeChange`/range-normalize/invalid-range,
  `SortSheetContent`'s distance-disabling); `RadioGroup`/`SearchInput`/
  `DefaultOptionRow`/`SpeciesOptionRow` (per-option `disabledValues` →
  `onDisabledPress` вместо `onChange`, `DefaultOptionRow`'s distance
  null/NaN-фильтрация, `SpeciesOptionRow`'s latin-name-когда-отличается);
  `hooks/useItem.ts`/`useList.ts` (URL по типу, cache-fallback на
  ошибку, `useList`'s `mergedFilters`/query-key чувствительность ко всем
  входам); `UniversalBottomSheet`/`ThemedToast`/`GlobalBottomSheet`
  (imperative `present`/`dismiss`, menu/confirm/content режимы,
  required-input match с trim+case-insensitive, `handleConfirm`'s
  error → dismiss сразу → `onError` через 400мс, `handleDismiss`'s guard
  против spurious replace-echo); `hooks/Profile/useExportProfile.ts`
  (`triggerExport`'s 429-still-polls-ветка, 5с polling loop,
  completed-без-download_token не останавливает поллинг, download-без-uri
  → failed, `cleanup` останавливает interval).

  Один реальный прод-баг найден и исправлен: `hooks/useList.ts`'s
  `locationKey` использовал `locationCoords?.[1]` **дважды** вместо `[0]`
  и `[1]` — смена одной только широты никогда не меняла query key, то
  есть список не перезапрашивался при таком изменении локации (кэш считал
  запрос идентичным). Заодно два прод-гэпа тестируемости закрыты:
  `PlaceDropdown` уже получил `testID` в прошлом батче;
  `PrivacyToggle`/`IconButton` — раньше; в этом батче — `RadioGroup`
  получил опциональный `testID`-проп (сгенерированные `${testID}-option-N`/
  `${testID}-option-N-checked`) по тому же паттерну, понадобился, чтобы
  проверить "который вариант отмечен" без завязки на визуальный стиль.

  Два методологических открытия, релевантных для будущих тестов той же
  формы:
  1. **react-query v5 "tracked queries"**: `useQuery`/`useInfiniteQuery`
     результат — объект с геттерами, который триггерит ре-рендер
     подписчика только на поля, реально прочитанные во время рендера.
     Кастомный хук вроде `useItem`, который читает только `query.error`
     (в deps эффекта) и возвращает весь `query` как есть, никогда не
     триггерит ре-рендер на переход pending→success в `renderHook`-тесте
     (raw `result.current` замирает на первом снепшоте навсегда —
     выглядит как зависший тест, а не как падение). Фикс — рендерить
     `() => ({ ...useItem(...) })` вместо `() => useItem(...)`,
     принудительно читая все поля (так же, как это делает реальный экран,
     который деструктурирует `{ data, isLoading, ... }`). См. комментарий
     в `useItem.test.tsx`/`useList.test.tsx`.
  2. Мнимый "хэнг" в одном прогоне `UniversalBottomSheet.test.tsx` при
     прямом вызове `onDismiss`-колбэка (симуляция реального dismiss от
     библиотеки) синхронным `act(() => cb())` — вторая setState-цепочка
     из трёх вызовов (`setPayload(null)`/`setInputValue("")`/
     `setIsLoading(false)`) выполнялась (подтверждено логами), но React
     не перерисовывал дерево до конца текущего теста; `await act(async
     () => { cb(); })` (асинхронная форма) чинит это — тот же класс
     проблемы, что и `useFocusEffect`-мок в `useSyncedFilters.test.tsx`
     (см. §6/четвёртый батч): синхронные обновления состояния вне
     event-хендлера иногда требуют асинхронного `act()`, даже когда сам
     колбэк синхронный.

  Итог: 1411 тестов, 124 suite, `npm run test`, `npm run check` и
  `npm run test:coverage` (83.21% stmts) зелёные.
- Шестой батч (83.21% → 86.88% stmts), шесть пунктов из прошлой ревизии
  этого раздела: `DiaryObservationCard`/`PlaceBlock`/`PlacePreviewRow`
  (тот же паттерн preview-fetch-с-кэшем, что уже был у `PlaceDropdown`);
  `MapL` (offline-фолбэк, 8с map-load timeout с ретраем, copy-coords,
  accuracy-оверлей, `subscribeToConnectionChange`-реакция — все смокано
  через `@maplibre/maplibre-react-native`, не реальный рендер тайлов);
  `DatePickerField`/`HourPicker` (Android скрывает пикер после выбора,
  iOS держит открытым; `HourPicker`'s авто-скролл к выбранному часу не
  падает); `LanguageSwitcher`/`ThemeSwitcher`; `useMediaLibraryUnavailable`/
  `useContentWidth`/`useSavedSort`/`useUpdateProfile` (`useContentWidth`'s
  breakpoint-клампинг, `useSavedSort`'s invalid-stored-value fallback);
  `services/bottomSheet.ts`/`ModalWrapper` (`bottomSheetRef.current`
  null-safety, `ModalWrapper`'s sort/apply-иконки условно).

  Два методологических уточнения, оба спровоцированы попыткой
  замокать/переопределить `react-native`'s core-экспорты:
  1. **Полная замена `react-native` через `jest.mock("react-native", () =>
     ({...jest.requireActual("react-native"), X: ...}))` ломает окружение**
     — react-native лениво объявляет свои экспорты через `Object.defineProperty`
     геттерами; spread (`{...actual}`) вычисляет их все сразу, что валит
     нативные-только модули (`DevMenu` и т.п.) вне контекста, где они
     обычно лениво не трогаются. Фикс — оборачивать `jest.requireActual
     ("react-native")` в `Proxy`, который форвардит доступ лениво и
     подменяет только нужный экспорт (`useWindowDimensions` в
     `useContentWidth.test.ts`, `Modal` в `ModalWrapper.test.tsx`) — тот же
     приём, что использовался для `@maplibre/maplibre-react-native` в
     `MapL.test.tsx`, только теперь для самого `react-native`.
  2. **`jest.spyOn` на namespace-объект НЕ ловит уже импортированную именную
     привязку**: `import { useWindowDimensions } from "react-native"` внутри
     `hooks/useContentWidth.ts` резолвится в конкретную функцию при загрузке
     файла (до того, как тест успевает вызвать `spyOn` внутри `it()`), так
     что подмена свойства на объекте модуля впоследствии эту привязку уже
     не меняет — нужен `jest.mock` (Proxy-вариант выше), а не `spyOn`,
     когда тестируемый модуль импортирует именованный экспорт напрямую.

  Итог: 1499 тестов, 138 suite, `npm run test`, `npm run check` и
  `npm run test:coverage` (86.88% stmts) зелёные.
- Батчи 7–11 (86.88% → 92.01% stmts) — не по коверидж-приоритету, а по
  ревизии списка "не включено намеренно" (см. новый текст в начале этого
  раздела для того, что именно было опровергнуто и почему). Пять батчей
  по плану ревизии:
  - **Батч 7** (state/persistence): `theme-context.tsx` (manual-vs-system
    приоритет, AsyncStorage save/load/remove round-trip, `ready`-гейт
    возвращает `null` до гидратации, ошибка при `getItem` не блокирует
    `ready`), `language-context.tsx` (stored-язык vs device-locale
    fallback, `i18n.changeLanguage`, персистентность). Рендерился реальный
    `*Provider` + `renderHook`, а не мок хука — паттерн из
    `auth-context.test.tsx`.
  - **Батч 8** (мелкая инфра, ошибочно считавшаяся тривиальной):
    `sortOptionsList.ts` (все 13 веток screen-кейсов + default),
    `openSupportEmail.ts` (`canOpenURL` true/false/throw, все три ведут в
    общий Toast-хендлер), `queryClient.ts` (retry-предикат:
    UNAUTHORIZED/isServerError не ретраятся, иначе один повтор),
    `navigationRef.ts` (`isReady()` true → dispatch сразу, false →
    очередь; `flushPendingNavigation` дренирует и чистит очередь один раз;
    более новый queued вызов перезаписывает более старый неслитый).
  - **Батч 9** (Layout/Splash, логика байпасилась моками в других
    тестах): `Layout.tsx` (тройное ветвление
    `withKeyboard`/`withScroll`/plain, `hideBackground`, `top`/`bottom`-
    слоты), `CustomSplash.tsx` (`onFinish` только после того, как ОБА —
    1с-таймер И `waitFor` — резолвнулись; таймер чистится на unmount).
  - **Батч 10** (простые Main-виджеты): `QuickActions.tsx`,
    `Stats.tsx`, `Sections.tsx` (изначально обнаружено и
    задокументировано как не исправлено: `showBadge` на "Diaries" был
    захардкожен в `false`, из-за чего бейдж с числом дневников никогда не
    рендерился — впоследствии, при разборе списка известных багов,
    признано мёртвым кодом и удалено целиком, а не включено обратно, см.
    ниже), `FloatingNavbar.tsx` (99+-кап, flag-vs-globe иконка,
    `useUnreadCount` замокан как отдельно покрытый хук).
  - **Батч 11** (Main-виджеты с реальным `useQuery`/`useList`):
    `ChecklistHero.tsx`, `BirdOfTheDay.tsx` (permission-подобная
    territory-резолюция filters→profile, BottomSheet-меню с двумя
    пунктами), `NewSpecies.tsx`/`RareNearby.tsx` (оба на `useList`,
    захвачен и напрямую протестирован `fetchFunction`-wrapper, который
    им передаётся — `fetchStatSeen` вырезает place/species и форсит
    `seen:true`; `RareNearby`'s дата+дистанция рендерятся только вместе,
    как единый блок, скрываемый целиком при `distance` falsy),
    `Sparkline.tsx` (dropdown-переключение режима меняет query key и
    реально ретриггерит fetch).

  Подтверждено на практике (не как открытие, а как принцип, применённый
  специально к КОМПОНЕНТНЫМ, не хуковым тестам): react-query v5's
  tracked-queries проблема из `useItem.test.tsx` (§7, пятый батч)
  проявляется только у `renderHook`-тестов кастомных хуков, которые
  возвращают весь `query`-объект как есть. У компонентов (`BirdOfTheDay`,
  `Sparkline`), которые сами деструктурируют `{ data, isLoading }` при
  рендере, поле уже "прочитано" естественным образом — спред не нужен,
  обычный `render` + реальный `QueryClient` работает как есть.

  Итог: 1643 теста, 155 suite, `npm run test`, `npm run check` и
  `npm run test:coverage` (92.01% stmts) зелёные.
- **`components/Main/Sections.tsx`'s мёртвый бейдж-код удалён.** При
  разборе списка известных багов (раздел 6) выяснилось, что `showBadge`
  использовался только для секции "Diaries" и был захардкожен в `false`
  ещё в апреле 2026 (коммит `f36d74c` "filters on main in progress"),
  никто не включал его обратно за три месяца. Значение бейджа —
  `data.diaries`, общее число дневников пользователя с учётом текущих
  фильтров (бэкенд `DashboardStatsView`), не "непрочитанные" в смысле
  push/notifications. Решение (по запросу пользователя): не включать
  бейдж обратно, а убрать мёртвую ветку целиком — `showBadge`-поле,
  ветку рендера, неиспользуемые стили `secBadge`/`secBadgeText`; заодно
  `Sections` перестал принимать больше не нужный ей проп `data`
  (`DashboardStat`), правка каскадом дошла до `screens/MainScreen.tsx`'s
  `<Sections />`. Тест `never shows a badge...` (документировавший баг)
  заменён на обычные тесты рендера/навигации без упоминания badge/data.
- **`components/Profile/ProfileForm.tsx`'s пропавшая error-подсказка на
  `DropdownInput` исправлена.** `invalid.territory`/`invalid.timezone`
  теперь прокинуты как `error={t("territory_required"/"timezone_required")}`
  на соответствующие `DropdownInput` — тот же паттерн (`error` → красная
  рамка + текст под полем), что уже используют `ObservationForm`/
  `DiaryForm`/`PlaceForm`. Ключ `timezone_required` был новым, добавлен в
  `locales/en.json`/`locales/ru.json` рядом с `timezone`;
  `territory_required` уже существовал. `ProfileForm.test.tsx` дополнен:
  проверка, что `error` выставляется при пустом submit и очищается после
  заполнения обоих полей и повторного submit.
- **`profileRepository.ts`'s `applyLocalPatch()`/`queuePendingAvatar()`
  больше не осиротают мутацию при гонке с логаутом.** При ревизии
  предыдущего пункта "недостижимо через реальный UI" выяснилось, что
  вывод был неполным — реальный путь к отсутствующей строке существует
  (форс-логаут racing с уже открытой формой профиля, см. подробный разбор
  в разделе 6 выше). Сначала написан красный тест, воспроизводящий именно
  эту гонку (`clearProfile()` → `applyLocalPatch()` → логин другим
  профилем → осиротевшая мутация всё ещё в очереди), затем — фикс: обе
  функции проверяют существование строки в начале своей транзакции через
  общий `hasProfileRow(tx)` и молча выходят, если строки нет, вместо
  безусловной постановки мутации в очередь. Не upsert — в момент гонки
  пользователь уже разлогинен, создавать строку профиля было бы
  неправильно. Заодно добавлен симметричный тест на no-op для
  `queuePendingAvatar` (тот же класс бага, тот же guard).
- **Батч 12 — план "что ещё нужно для безопасного релиза" по запросу
  пользователя, три согласованных направления**: перевести оставшиеся
  ручные пункты чек-листа в автотесты, точечные тесты на риски вне
  чек-листа, iOS Maestro-паритет (полный план обсуждался отдельно, не
  здесь). Первый шаг — верификация: прежде чем писать что-либо новое,
  каждый пункт из плана сверен с реальным состоянием кода. Результат
  оказался важнее самого батча: **добрая половина запланированных
  пунктов уже была закрыта раньше**, а этот документ просто не был
  обновлён вслед за тестами (см. пометки "[x] ... оказалось устаревшим"
  в разделах 3–5 выше) — конкретно: foreground/background resync (>10с),
  discard родителя до синка, syncBatch async-ordering инвариант
  (`syncBatch.test.ts` + `backgroundSyncBatching.test.ts`), `inFlight`-дедуп
  и backoff-таймер (`diarySync.test.ts`/`observationSync.test.ts`'s
  "concurrency"/"stopXSyncRetries" блоки), `FailedEditBanner` UI, и
  cross-site согласованность округления координат (`helpers.test.ts`'s
  `roundCoords` уже включает тест на "два близких GPS-фикса → один и тот
  же rounded key"). Ничего из этого не переписывалось заново — только
  сверено и отмечено в разделах выше. Урок на будущее: перед тем как
  писать тест на "непокрытый" сценарий из этого документа, сначала
  `grep` реальный тестовый файл — сам документ не авторитетный источник
  истины о текущем покрытии, только код и его тесты являются им (тот же
  урок уже был один раз извлечён при ревизии батчей 7–11, теперь
  подтверждён снова, но уже по независимой оси: не "обоснование
  написано по памяти", а "чек-лист не поспевает за темпом добавления
  тестов").

  Из того, что оставалось после верификации, закрыто:
  - `hooks/__tests__/useDropdownQuery.test.tsx`'s новый блок "24h
    staleTime" — `SpeciesDropdown`'s 24-часовой `staleTime`/`gcTime`,
    единственный из перечисленных выше пробелов, подтвердившийся при
    проверке. `Date.now` мокается напрямую (`jest.spyOn`), не через
    `jest.useFakeTimers()`/`advanceTimersByTime` — react-query's
    staleness-проверка просто сравнивает с `Date.now()`, а полноценные
    fake timers мешали бы `waitFor`'s собственному `setTimeout(0)`-polling
    (тот же класс проблемы, что уже документирован в §7 для
    `notifyManager`/`useFocusEffect`-моков).
  - `services/db/__tests__/migrationSafety.test.ts` (новый файл) — риск,
    которого вообще не было в чек-листе: все 13 drizzle-миграций сейчас
    строго аддитивны (`CREATE TABLE`/`CREATE INDEX`/`ALTER TABLE ADD`
    nullable-колонка, один `DROP TABLE` одноразового cache — см. их
    исходники), так что реального бага миграция-на-непустой-БД не нашла
    и не могла найти, но это ничего не говорит про **следующую**
    миграцию, у которой такой аддитивности может не быть. Тест сеет
    строки в уже созданные таблицы (schema на состоянии до 0012) и
    прогоняет `0012_confused_retro_girl.sql` (добавляет
    `pending_avatar_uri`/`pending_avatar_op` в `profile`) поверх —
    проверяет, что существующая строка не теряется и не бьётся
    `ALTER TABLE`. Плюс отдельный сквозной тест: сидировать по одной
    строке в `profile`/`observation`/`diary`/`place` сразу после их
    `CREATE TABLE` и прогнать все последующие миграции без ошибки — общий
    регресс-guard на будущее, не привязанный к конкретной миграции.
    Запускает сырые `.sql`-файлы через `better-sqlite3.exec()` напрямую
    (не drizzle's `migrate()` — тот всегда прогоняет весь каталог
    целиком, нет поддерживаемого способа остановить его на середине), но
    та же схема (`services/db/schema.ts`), что и продакшен/остальные
    repository-тесты через `testDb.ts`.
  - Три новых Maestro Android-флоу + iOS-паритет по update/delete (все
    описаны в разделах 1/3/4/5 выше, включая новые `testID`
    (`alert-enabled-switch`, `burger-menu-button`) в продакшен-коде,
    понадобившиеся для двух из них) — написаны по образцу уже проверенных
    флоу того же каталога, но **ещё ни разу не прогонялись на реальном
    устройстве/эмуляторе** в этой сессии (без доступа к нему). Перед тем
    как полагаться на них как на часть раздела 1, дать каждому хотя бы
    один ручной прогон и поправить селекторы по месту, если что-то не
    совпало — это единственный пункт этого батча, который не был
    независимо перепроверен `npm run test`/`npm run check` (те прошли
    зелёными, `npm run test:coverage` — 91.94% stmts, 1755 тестов, 163
    suite).
  - Про CI (`bitbucket-pipelines.yml`) — обсуждалось отдельно с
    пользователем, сознательно не взято в этот батч по приоритету (см.
    раздел 6) — не потому что сложно или не нужно.
- CI (`bitbucket-pipelines.yml`) добавлен: `npm run check` + `npm run
  test:ci` на каждый push в master (Pipelines включены в Bitbucket UI).
  Первый прогон нашёл упавший `queryPersist.test.ts` — мок
  `shouldDehydrateQuery` для `"Places"`/`"DashboardStat"` не передавал
  `state: { status: "success" }`, из-за чего код падал на
  `query.state.status` (проходило только для `"DiarySpecies"` благодаря
  короткому замыканию `&&`); поправлено. Отдельно от этого пайплайн
  зависал даже на зелёном прогоне — repository-тесты держат нативные
  `better-sqlite3`-хендлы открытыми на весь воркер-процесс (см. коммент в
  `hooks/repositories/testDb.ts`), и под контейнером Bitbucket jest не
  завершал процесс сам после печати предупреждения об этом, в отличие от
  локального запуска; добавлен `test:ci` = `jest --forceExit`,
  используется только в pipeline, `npm run test` для локальной разработки
  не тронут.
