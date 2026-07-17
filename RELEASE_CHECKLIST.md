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

`npm run e2e` / `npm run e2e:android` пока **не входят** в автоматический
гейт (нет CI-раннера с эмулятором/симулятором и собранным dev-client
билдом), но реальные Maestro-флоу уже покрывают основные пути и годятся
для ручного прогона перед релизом:

```bash
npm run e2e             # iOS: login.yaml + create-observation.yaml
npm run e2e:android      # Android: offline-/online-create-{diary,observation,place}.yaml
npm run e2e:android -- .maestro/offline-create-place.yaml   # можно указать один флоу явно
```

Оба скрипта — обёртка `.maestro/run.sh`: сами находят booted-симулятор
(iOS) или подключённый emulator/device (Android, включая автопоиск `adb`
в стандартных путях SDK) и подставляют явный `--device`, поэтому больше не
нужно вручную выяснять UDID или ловить зависание Maestro на поиске
Android-устройства (см. историю в git blame `.maestro/run.sh`, если
понадобятся детали того бага). Credentials берутся из
`.maestro/.env.local` (gitignored, `TEST_EMAIL`/`TEST_PASSWORD`) — файл
нужно завести локально перед первым запуском.

Требования к устройству:
- iOS: booted-симулятор с установленным dev-client билдом (`com.dibird.app.dev`).
- Android: запущенный emulator/device с установленным dev-client билдом
  (`com.dibird.app`) **и** актуальным LAN IP хоста в
  `.maestro/common/android-bootstrap.yaml` (`exp://<IP>:8081`) — при смене
  сети/хоста надо обновить руками.

Офлайн-синхронизация на iOS (Simulator не умеет переключать airplane
mode на уровне ОС) и push всё ещё не автоматизированы; см. раздел 6.

## 2. Авторизация и онбординг

Основано на: `screens/WelcomeScreen.tsx`, `util/auth.ts` (Login/CreateUser/
Logout/LoginWithGoogle/LoginWithApple — `services/authService.ts` — это
только маленький token-update callback registry, не сама auth-логика),
`services/api.ts` (interceptors), `store/auth-context.tsx`,
`hooks/useBiometricSetting.ts`, `services/bio.ts`.

Автоматизировано (`.maestro/login.yaml`, iOS, ручной прогон): email/
password логин — сначала заведомо неверный пароль (проверяет, что
попытка реально отправляется и отклоняется, а не просто исчезает
Welcome-экран), затем настоящие креды → посадка на MainScreen.
`create-observation.yaml` и Android-флоу переиспользуют уже сохранённую в
Keychain/сессии авторизацию вместо повторного прогона логина.

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
- [ ] Первый вход нового пользователя (`is_new_user`) не путается с
      повторным логином — экран не дублирует онбординг.
- [ ] Face ID/Touch ID: включить `biometric_enabled`, перезапустить
      приложение — `restoreToken` требует `LocalAuthentication` перед
      восстановлением токена. Сам системный prompt и его отмену
      (`res.success === false`) — только на устройстве/симуляторе
      (гейтинг-логика `canUseBiometrics`/`shouldUseBiometrics` уже
      покрыта `bio.test.ts`).

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

Остаётся ручной проверкой:

- [ ] iOS: тот же offline-цикл (create в авиарежиме → pending-иконка →
      реконнект → синк) — Maestro не может переключать авиарежим на
      симуляторе, аналога `offline-create-*.yaml` для iOS нет.
- [ ] Свернуть приложение в фон на >10 сек с pending-записью и вернуть на
      передний план → синк повторно триггерится (foreground-хук с 500мс
      дебаунсом и порогом 10 сек в каждом `use*Sync.ts`) — не покрыто ни
      Maestro, ни unit-тестами.
- [ ] Смоделировать ошибку не-сетевого типа (например, 400 от бэкенда) на
      реальном устройстве → запись помечается `status:"error"`, в
      детальном экране появляется `FailedEditBanner` с кнопками
      retry/discard — сама логика error/retry/discard покрыта
      repository-тестами, но UI `FailedEditBanner` и реальный 400 от
      бэкенда — только руками.
- [ ] Создать Observation внутри ещё не засинканного офлайн Diary (temp
      id) → после синка родительского Diary дочернее Observation
      корректно переразрешает `diary` id — резолв id покрыт
      repository-тестами, но сквозной UI-сценарий (создание вложенной
      записи, дождаться синка родителя) — только руками.
- [ ] Отдельно: родительский Diary отменили (discard) до синка — дочерняя
      мутация должна зафейлиться с понятной ошибкой, а не зависнуть.
- [ ] `PlaceEditorScreen`, созданный офлайн и использованный в
      Observation, аналогично резолвится через
      `placeRepository.resolvePlaceId`.

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

Остаётся ручной проверкой:

- [ ] iOS: update/delete записи (только create покрыт `create-observation.yaml`).
- [ ] `SpeciesDropdown`: реальный 24ч TTL кэша (`useDropdownQuery`) —
      Maestro-флоу всегда бьёт по холодному/тёплому кэшу той же сессии, не
      проверяет истечение через 24 часа.
- [ ] Разрешение геолокации: явно отклонить permission на устройстве и
      убедиться, что ручной ввод координат/выбор на карте всё ещё
      работает (`usePlaceLocation`'s `normalizeCoords`), а не блокирует
      экран целиком — Maestro-флоу для Place всегда даёт location
      permission заранее.

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
- [ ] Изменения настроек алертов, сделанные офлайн, реально
      синхронизируются при восстановлении сети на реальном устройстве —
      сама sync-логика и reconnect/foreground-триггер уже покрыты юнит-
      тестами, но не сквозной UI-сценарий (экран → офлайн → онлайн).

## 6. Что дальше (осознанно не входит в этот релизный гейт)

Платформенно/инфраструктурно заблокированное — не задача тестирования,
ждёт либо возможностей платформы, либо CI-инфраструктуры:

- iOS-офлайн (раздел 3) и push-уведомления (раздел 5) осознанно не
  автоматизированы в Maestro — `toggleAirplaneMode` недоступен на iOS
  Simulator (нет radio-стека), а push требует управления инфраструктурой
  пуш-сервиса; надёжность такой автоматизации под вопросом, пока остаются
  ручными пунктами чек-листа.
- iOS-флоу для update/delete (только create на данный момент) и iOS-версии
  offline-*.yaml (см. выше, блокировано платформой, не приоритетом).
- CI на GitHub Actions, гоняющий `npm run check` + `npm test` (и, когда
  будет готова сборка для симулятора/эмулятора в CI, `npm run e2e` /
  `npm run e2e:android`) на каждый PR — сейчас всё из раздела 1
  выполняется вручную разработчиком перед релизом.

### Известные баги, найденные тестами, но сознательно не исправленные

Пусто. Оба пункта, раньше числившиеся здесь, оказались исправлены — см.
журнал §7 (последние две записи) за подробностями: `ProfileForm.tsx`'s
пропавшая error-подсказка на `DropdownInput`, и `profileRepository.ts`'s
`applyLocalPatch()`/`queuePendingAvatar()`, у которых обоснование
"недостижимо через реальный UI" при повторной проверке оказалось
неполным (реальный путь — форс-логаут, гонящийся с уже открытой формой
профиля).

### Состояние покрытия и что осталось

`npm run test:coverage` после седьмого батча — 92.01% stmts (был 47.3% →
60.39% → 69.0% → 74.23% → 78.16% → 83.21% → 86.88% → 92.01%).

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
{BackgroundScene*,CustomSplash}.tsx`'s декоративные соседи (сам
`BackgroundScene.tsx`/`BackgroundScene3.tsx` — чистая SVG-геометрия;
`BackgroundScene2.tsx` — минимальный `useState` для `onLayout`, но без
интерактивности), 4 `*Skeleton.tsx`-файла в `components/Main/`
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

- Maestro (8 флоу): `login.yaml`/`create-observation.yaml` (iOS) и
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
