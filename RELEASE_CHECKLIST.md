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

- Готово: 8 Maestro-флоу — `login.yaml`/`create-observation.yaml` (iOS) и
  `{offline,online}-create-{diary,observation,place}.yaml` (Android,
  полный create → update → delete цикл, офлайн-версии с реальным
  OS-level airplane mode). Потребовали добавить `testID` в несколько
  ключевых мест (`Input`, `IconButton`/`IconsHeader`, FAB/quick-actions,
  триггеры дропдаунов территории/вида) — в приложении не было ни testID,
  ни accessibilityLabel.
- Готово: repository-слой (`diary`/`observation`/`place`/`alertSettings`/
  `profile`Repository) покрыт jest-тестами поверх реальной sqlite
  (`hooks/repositories/testDb.ts`, checked-in миграции) — входит в
  `npm run test`, сократил долю ручной проверки в разделе 3 (error/retry/
  discard, резолв temp-id). При написании тестов всплыли и исправлены два
  однотипных бага в `profileRepository.ts`/`alertSettingsRepository.ts`:
  `resolveMutation()` в обоих файлах помечала запись `"synced"`
  безусловно, не проверяя другие ещё pending-мутации (теперь пересчитывает
  `remaining`, как уже делал `discardMutation()`); `applyLocalPatch()` в
  `alertSettingsRepository.ts` не создавала settings-строку, если её ещё
  не было (голый `UPDATE` без `.where()`/upsert) — заменено на
  `onConflictDoUpdate`. Аналогичный баг в `profileRepository.ts`'s
  `applyLocalPatch()` сознательно **не** чинили: там первичный ключ —
  реальный `user`-id с сервера, а не фиксированный синглтон, так что
  создать валидную строку без него нечем; вместо фикса — тест
  задокументировал, что сценарий недостижим через реальный UI
  (`ProfileScreen.tsx` не рендерит форму редактирования, пока `profile` не
  загружен, а бэкенд создаёт `Profile` для любого `User` сразу при
  регистрации — `myapi/signals.py`'s `post_save`).
- Готово: auth/security (`util/auth.ts`, `services/api.ts`'s 401-refresh
  интерсептор, `services/bio.ts`) и push/alert-sync
  (`usePushNotifications.ts`, `alertSettingsSync.ts` + его
  reconnect/foreground-триггер в `alert-settings-context.tsx`) закрыты
  юнит-тестами — раньше это были модули с нулевым покрытием, теперь входят
  в обязательный гейт раздела 1. При написании `api.test.ts` нашли и
  исправили баг: `clearTokens()` сбрасывала `isLoggingOut` в `false`
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
- Готово (batch 1/N): `screens/**` — раньше 0 файлов на весь каталог (29
  экранов) и полностью исключён из `collectCoverageFrom`. Первые 5 —
  `WelcomeScreen`/`ProfileScreen`/`AlertSettingsScreen`/
  `NotificationsScreen`/`ObservationEditorScreen` — выбраны как самые
  рискованные по самому этому чек-листу (см. §2/§4/§5 выше). Установлены
  переиспользуемые конвенции для всех будущих экранных тестов:
  `screens/test-utils.tsx` (фабрика мока навигации,
  `useNavigation`/`useRoute`/`getParent`) и `screens/mockTheme.ts`
  (расшаренный `Colors`-мок, ранее дублировался в 2 компонентных тестах) —
  оба лежат **рядом** с `screens/__tests__/`, не внутри (иначе jest
  пытается запускать их как отдельные test suite, см. `testDb.ts`'s
  такое же расположение для repository-тестов). Для `@tanstack/react-query`
  — мокать модуль/кастомный хук, не поднимать `QueryClientProvider`
  (соответствует единственному прежнему прецеденту в репо). Тяжёлые дочерние
  формы/виджеты (`ProfileForm`, `ObservationForm`, `RadiusRow`,
  `TimeWindowRow`, `IconsHeader`) застаблены — тестируется оркестрация
  экрана, а не чужая вложенная форма. По пути найдены и обойдены четыре
  дыры окружения (не в коде продукта): `react-native-safe-area-context` и
  `RTL v14` убрала `UNSAFE_getByType`/`UNSAFE_getByProps` (добавлены два
  `testID` — `ItemsList`'s `FlatList`, `LoadingOverlay`); `Pressable`
  внутри `IconButton` не всегда уважает `onPress: undefined` при disabled
  под fireEvent.press в этой связке RN/RTL (обойдено стабом
  `IconsHeader`); реальные `setTimeout(…, 1500)` в `ProfileScreen`/
  `ObservationEditorScreen` требуют fake timers, иначе тест оставляет
  висящий таймер.
- В процессе: `ListScreen.tsx` (общий shell для 8+ экранов —
  Diaries/Observations/Places/Community/Rating/RatingsCompare/Stat/
  UserStat, самая широкая поверхность мока в репозитории — filters-
  context/location-context/language-context/BottomSheet) и оставшиеся ~23
  экрана. См. `screens/__tests__/` по мере готовности; этот пункт чек-
  листа обновится, когда batch закроется.
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
