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

- **`hooks/repositories/profileRepository.ts`'s `applyLocalPatch()`** не
  создаёт settings-строку, если её ещё не было (голый `UPDATE` без
  `.where()`/upsert) — тот же класс бага, что был в
  `alertSettingsRepository.ts` (там пофикшен, см. журнал ниже). **Почему
  не исправлено:** первичный ключ таблицы — реальный `user`-id с сервера,
  а не фиксированный синглтон, так что создать валидную строку без него
  нечем (в отличие от alertSettings, где upsert на известный синглтон-ключ
  тривиален). Вместо фикса — тест задокументировал, что сценарий
  недостижим через реальный UI: `ProfileScreen.tsx` не рендерит форму
  редактирования, пока `profile` не загружен, а бэкенд создаёт `Profile`
  для любого `User` сразу при регистрации (`myapi/signals.py`'s
  `post_save`). Если когда-нибудь появится путь к `applyLocalPatch` без
  загруженного профиля, тест должен упасть первым.
- **`components/Profile/ProfileForm.tsx`'s `validateForm()`** считает
  `invalid.territory`/`invalid.timezone`, но эти флаги никогда не
  передаются в соответствующие `DropdownInput` (только
  `invalid.userName` доходит до `Input`'s `isInvalid`) — заблокированный
  submit не даёт пользователю видимой подсказки, какое поле не заполнено,
  кроме username. **Почему не исправлено:** это изменение видимого
  поведения UI (какое именно визуальное состояние error должно показывать
  `DropdownInput` — рамка, текст под полем и т.д.), а не только тестовый
  гэп; требует отдельного решения/дизайн-ревью, не входит в задачу
  написания тестов.

### Следующие кандидаты на автотесты (по коду покрытия, приоритет по риску)

`npm run test:coverage` после двух батчей — 69.0% stmts (был 47.3% →
60.39% → 69.0%). Список из прошлой ревизии этого раздела (репозитории/
`useDropdownQuery`/`usePlaceLocation`/`storageHelper`/`alertSettings`/
`useApiError`/8 Card-компонентов/4 общих поля форм) полностью закрыт —
см. журнал (§7) для деталей. Ниже — не выполненный, а предлагаемый
порядок для следующего захода:

1. **`components/Auth/{AuthContent,AuthForm}.tsx`** (0%) — форма входа,
   прямая зависимость `WelcomeScreen`/`LoginScreen`, риск из §2; сейчас
   застаблены целиком в тестах этих экранов, сама валидация/wiring полей
   формы логина нигде не проверена напрямую (тот же класс пробела, что
   был у `ObservationForm`/`DiaryForm`/`PlaceForm`/`ProfileForm` до
   прошлого батча).
2. **`components/ui/{IconsHeader,IconButton}.tsx`** (0%/22%) — общий
   header-виджет, используется в большинстве экранов и уже дважды
   всплывал как источник ложных тестов на уровне экранов (см. журнал §6:
   `condition`-фильтрация, `disabled` не долетающий до `onPress`) —
   сейчас проверяется только опосредованно через самодельные стабы в
   каждом экранном тесте, а не напрямую.
3. **`components/ui/{Section,PrivacyToggle,RadiusRow,TimeWindowRow,Tabs}.tsx`**
   (0%) — общие поля `AlertSettingsScreen`/форм редакторов, тот же класс
   риска, что и уже закрытые общие поля форм.
4. **`hooks/useFilterLabels.ts`/`hooks/useSyncedFilters.ts`** (0%) —
   деривация текста фильтров и синхронизация URL/deep-link фильтров с
   `filters-context`, нетривиальная логика без прямого покрытия.
5. **`components/ui/{DropdownInput.tsx}`'s делегаты
   `SpeciesDropdown.tsx`/`PlaceDropdown.tsx`/`SelectListModal.tsx`**
   (5–7%) — сам `DropdownInput` теперь 98%, но три компонента, которым он
   делегирует специализированный рендеринг, остаются непокрытыми (были
   замоканы в `DropdownInput.test.tsx` как раз чтобы изолировать его
   собственную оркестрацию).
6. **`services/errors.ts`** (51%) — `toUIError`/error-классификация,
   центральная для `useApiError`/`useMutationWithTranslation`, сейчас
   покрыта только частично через побочный эффект других тестов.
7. **`hooks/useBiometricSetting.ts`** (0%) — `SecureStore`-обёртка,
   маленькая, но напрямую отвечает за пункт риска в §2 (Face ID/Touch ID
   toggle), уже используется в `SettingsScreen` (застаблен там).
8. **`components/Profile/{Avatar,ProfileAvatar,CompareProfileHeader}.tsx`**
   (0–35%) — аватар/профильные виджеты, используются почти во всех
   detail-экранах (сейчас застаблены везде).

Не включены намеренно: `components/Main/*` (дашборд-виджеты, чисто
презентационные, низкий риск), `store/theme-context.tsx`/`language-context.tsx`
(конфигурационные, меняются редко), `services/{sentry,queryClient,
navigationRef}.ts` (тонкие обёртки над SDK), `components/ui/BackgroundScene*.tsx`/
`CustomSplash.tsx` (чисто декоративные).

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
