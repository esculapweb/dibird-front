# Чек-лист тестов перед релизом DiBird

Документ фиксирует, что обязано быть зелёным перед публикацией релиза, и
какие сценарии нужно вручную (или через Maestro, когда появятся реальные
flow-файлы) прогнать руками, потому что автотестов на них ещё нет.

## 1. Обязательный автоматический гейт (блокирует релиз, если красный)

```bash
npm run check          # tsc --noEmit && eslint .
npm run test           # весь текущий jest-набор
```

`npm run e2e` пока **не входит** в автоматический гейт (нет CI-раннера с
эмулятором/симулятором и собранным dev-client билдом), но реальные флоу уже
есть и годятся для ручного прогона перед релизом:

```bash
UDID=$(xcrun simctl list devices | grep -i booted | grep -oE '[0-9A-F-]{36}')
maestro test --device "$UDID" --env TEST_EMAIL=... --env TEST_PASSWORD=... .maestro/login.yaml
maestro test --device "$UDID" --env TEST_EMAIL=... --env TEST_PASSWORD=... .maestro/create-observation.yaml
```

`create-observation.yaml` переиспользует `login.yaml` через `runFlow`, так
что достаточно запустить один второй файл для сквозной проверки раздела 4.

**Важно про `--device`**: если на машине когда-либо запускался Android
Studio / эмулятор, в фоне может остаться зависший `adb`-сервер на порту
5037. Maestro по умолчанию пытается достучаться и до Android при поиске
устройств и молча зависает навсегда, если этот сервер не отвечает —
никакой ошибки не будет, просто тишина после строк про Java/JVM warnings.
Явный `--device <UDID>` полностью обходит эту проверку. `npm run e2e`
(без `--device`) уже отключает отправку аналитики
(`MAESTRO_CLI_NO_ANALYTICS=1`, тоже раньше вызывала похожее молчаливое
зависание), но не обходит проверку Android — если словите тишину после
warnings, используйте `--device` напрямую, как выше.

Офлайн-синхронизация и push всё ещё не автоматизированы; см. раздел 6.

## 2. Авторизация и онбординг (ручная проверка на iOS + Android)

Основано на: `screens/WelcomeScreen.tsx`, `services/authService.ts`,
`services/api.ts` (interceptors), `store/auth-context.tsx`,
`hooks/useBiometricSetting.ts`, `services/bio.ts`.

- [ ] Вход через Google (`GoogleSignin`) и через Apple
      (`expo-apple-authentication`, только iOS, за `isAvailableAsync()`) —
      оба варианта на чистой установке.
- [ ] Регистрация/логин по email через `Login`/`Signup`
      (`/api-auth/login/`, `/api-auth/registration/?agree_terms=1`).
- [ ] Первый вход нового пользователя (`is_new_user`) не путается с
      повторным логином — экран не дублирует онбординг.
- [ ] Разлогин: `Logout()` чистит `SecureStore`-токены, анрегистрирует
      push-токен, разлогинивает `GoogleSignin`, чистит AsyncStorage-ключи
      (`profile/filters/sorting/global`).
- [ ] Протухший токен: 401 → авто-refresh через
      `/api-auth/token/refresh/` → повтор запроса; при неудаче —
      принудительный логаут через `onUnauthorizedCallback`.
- [ ] Face ID/Touch ID: включить `biometric_enabled`, перезапустить
      приложение — `restoreToken` требует `LocalAuthentication` перед
      восстановлением токена. Проверить на iOS-симуляторе, где Face ID
      недоступен — ветка "App Store review sandbox" в `services/bio.ts`
      не должна блокировать обычный вход.

## 3. Офлайн-синхронизация (ключевой риск — ручная проверка обязательна)

Основано на: `hooks/{Diary,Observation,Place,Notification}Sync.ts` (все —
зеркальные копии одного паттерна), `services/sync/*.ts`,
`hooks/repositories/{diary,observation,place}Repository.ts` (mutation
queue), `components/Profile/FailedEditBanner.tsx`.

- [ ] Создать Observation/Diary/Place **в авиарежиме** → запись появляется
      в списке сразу с иконкой "pending" (`_pendingSync === "pending"` в
      `ObservationCard.tsx`/`DiaryCard.tsx`).
- [ ] Включить сеть обратно → синхронизация стартует автоматически
      (триггер — `subscribeToReconnect`, NetInfo `!connected →
      connected`), pending-иконка пропадает, запись получает настоящий id
      с сервера.
- [ ] Свернуть приложение в фон на >10 сек с pending-записью и вернуть на
      передний план → синк повторно триггерится (foreground-хук с 500мс
      дебаунсом и порогом 10 сек в каждом `use*Sync.ts`).
- [ ] Смоделировать ошибку не-сетевого типа (например, 400 от бэкенда) →
      запись помечается `status:"error"`, в детальном экране появляется
      `FailedEditBanner` с кнопками retry/discard — проверить обе кнопки.
- [ ] Создать Observation внутри ещё не засинканного офлайн Diary (temp
      id) → после синка родительского Diary дочернее Observation
      корректно переразрешает `diary` id (`resolveObservationDiary` /
      `resolveDiaryId`).
- [ ] Отдельно: родительский Diary отменили (discard) до синка — дочерняя
      мутация должна зафейлиться с понятной ошибкой, а не зависнуть.
- [ ] `PlaceEditorScreen`, созданный офлайн и использованный в
      Observation, аналогично резолвится через
      `placeRepository.resolvePlaceId`.

## 4. Создание наблюдения/дневника — основной пользовательский путь

Основано на: `screens/{Observation,Diary}EditorScreen.tsx`,
`hooks/useEditorForm.ts`, `components/ui/SpeciesDropdown.tsx`,
`hooks/Place/usePlaceLocation.ts`, `hooks/Observation/useOfflineObservation.ts`.

- [ ] Полный цикл **онлайн**: выбор вида через `SpeciesDropdown`
      (кэшируется на 24ч через `useDropdownQuery`, первый заход в новой
      территории должен сходить в сеть за списком), выбор/автоопределение
      места (`locateMe()` + ручной пин на MapLibre-карте), дата/время,
      количество, заметки, приватность → Save → запись реально создаётся
      на бэкенде.
- [ ] Полный цикл **офлайн** (см. раздел 3) — Save работает без сети,
      ничего не виснет и не падает.
- [ ] Редактирование уже засинканной записи (положительный id) — online и
      offline-путь (`useUpdateObservation`).
- [ ] Удаление записи — как для положительного id (сразу на сервер), так
      и для ещё не засинканной (temp id, чисто локальное удаление без
      сетевого вызова).
- [ ] Разрешение геолокации: явно отклонить permission на устройстве и
      убедиться, что ручной ввод координат/выбор на карте всё ещё
      работает (`usePlaceLocation`'s `normalizeCoords`), а не блокирует
      экран целиком.

Явно **не проверяем**: прикрепление фото к Observation/Diary — такого
поля нет в `EditorFormData`/`ObservationForm`/`DiaryForm` (фото есть
только у аватара профиля, `components/Profile/Avatar.tsx`, это отдельный
поток — см. раздел 5 профиля при необходимости).

## 5. Уведомления и алерты

Основано на: `hooks/usePushNotifications.ts`,
`screens/AlertSettingsScreen.tsx`, `services/alertSettings.ts`,
`hooks/repositories/alertSettingsRepository.ts`, `hooks/useUnreadCount.ts`,
`screens/NotificationsScreen.tsx`.

- [ ] Разрешение на push-уведомления: первый вход → системный запрос →
      `Notifications.getExpoPushTokenAsync()` → токен реально
      регистрируется на бэкенде (`registerPushToken`).
- [ ] Отклонить разрешение на push — приложение не падает и просто не
      регистрирует токен.
- [ ] Регистрация токена при отсутствии сети в момент выдачи разрешения →
      токен дорегистрируется автоматически при восстановлении связи
      (`subscribeToReconnect` retry-once в `usePushNotifications.ts`).
- [ ] Тап по push-уведомлению для каждого из 4 маршрутов
      (`Community`/`SpeciesDetail`/`Achievements`/`Checklist`) действительно
      открывает нужный экран (`handleNotificationNavigation`).
- [ ] Счётчик непрочитанных (`useUnreadCount`, polling 2 мин) корректно
      уменьшается при прочтении, включая офлайн-пометку "прочитано" с
      последующей синхронизацией (`notificationRepository`, sentinel id
      -1 для "пометить всё прочитанным").
- [ ] `AlertSettingsScreen`: включить алерты с геолокацией → отклонить
      разрешение на локацию → экран показывает понятное состояние, а не
      крашится (`useLocationUnavailable`).
- [ ] Изменения настроек алертов, сделанные офлайн, реально
      синхронизируются при восстановлении сети (`alertSettingsSync.ts`).

## 6. Что дальше (осознанно не входит в этот релизный гейт)

- Готово: `.maestro/login.yaml` и `.maestro/create-observation.yaml` —
  реальные флоу для входа и создания Observation онлайн (раздел 2 и часть
  раздела 4). Потребовали добавить `testID` в несколько ключевых мест
  (`Input`, `IconButton`/`IconsHeader`, FAB в `ListScreen`, триггеры
  дропдаунов территории/вида) — в приложении не было ни testID, ни
  accessibilityLabel, а кнопка сохранения Observation — иконка без текста.
- Офлайн-синхронизация (раздел 3) и push-уведомления (раздел 5) осознанно
  не автоматизированы в Maestro — требуют управления airplane-mode/push
  инфраструктурой, надёжность такой автоматизации под вопросом; пока
  остаются ручными пунктами чек-листа.
- CI на GitHub Actions, гоняющий `npm run check` + `npm test` (и, когда
  будет готова сборка для симулятора в CI, `npm run e2e`) на каждый PR —
  сейчас всё из раздела 1 и флоу из этого пункта выполняются вручную
  разработчиком перед релизом.
- Автотесты на repository-слой (`diaryRepository`/`observationRepository`/
  `placeRepository`/`alertSettingsRepository`) с переиспользуемым
  drizzle-мок-хелпером — отдельный батч, который со временем сократит
  долю ручной проверки в разделах 3 и 5.
