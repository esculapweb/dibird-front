# CLAUDE.md

Инструкции для работы с этим репозиторием (Dibird — React Native / Expo приложение).

## Правила поведения

- Отвечай всегда на русском языке — независимо от языка вопроса, кода или комментариев.
- **Комментарии в коде — только на английском.** Это касается всех видов: `//`, блочных `/* */`, JSDoc `/** */` и JSX `{/* */}`. Правило про ответы на русском на код не распространяется: пишешь новый комментарий или правишь существующий — по-английски. Русский в коде допустим только внутри строк-данных (фикстуры тестов, значения `locales/ru.json`, ru-строки в config-плагинах) и как процитированный пример локализованного текста внутри английского комментария (см. `util/sortOptionsList.ts`, `types.ts`).
- Меняй только то, что нужно для задачи; не рефактори попутно и не трогай несвязанные файлы. Но если по пути замечаешь баг, потенциальную проблему или уместный рефакторинг — сообщи об этом отдельным пунктом в конце ответа, не правя молча. Не глуши находку молчанием и не исправляй без спроса (кроме случаев, когда без фикса задача не работает).
- При неоднозначных требованиях — задай уточняющий вопрос, не додумывай. Честно говори, когда не уверен.
- Переиспользуй существующие утилиты и паттерны вместо новых сущностей — ищи перед тем, как писать.
- Не считай работу законченной, пока `npm run check` и `npm test` не зелёные — показывай вывод.
- Сохраняй стиль «почему»-комментариев: неочевидные edge-cases (react-query/offline, регрессии) документируй комментарием — на английском (см. выше).

## Git

- **Коммиты я делаю сам.** Не запускай `git commit`, `git push` и т.п. даже после согласованной реализации — только вношу изменения в файлы.

## Команды

- `npm run check` — typecheck (`tsc --noEmit`) + eslint. Прогоняй перед тем, как считать работу законченной.
- `npm run typecheck` — только проверка типов.
- `npm run lint` — только eslint.
- `npm test` — jest. `npm run test:watch` для разработки.
- `npm run e2e` — Maestro e2e (`.maestro/run.sh`), `npm run e2e:ios` / `e2e:android`, `npm run e2e:parallel` — обе платформы одновременно (`.maestro/run-parallel.sh`, логи в `.maestro/.logs/`). Один флоу — аргументом: `npm run e2e:ios -- .maestro/login.yaml`. Аккаунт свой на каждую платформу (`IOS_EMAIL`/`ANDROID_EMAIL` в `.maestro/.env.local`) — именно это и позволяет гонять параллельно. Платформа флоу задаётся тегами в его шапке; состав и платформенные ограничения — в `RELEASE_CHECKLIST.md` §1.
- `npm start` — Expo dev server. `npm run ios` / `npm run android` — нативная сборка.
- `npm run i18n:extract` — извлечение строк локализации.

## Стек

Полный список зависимостей — в `package.json`; ниже только ключевые архитектурные выборы. Для задачи бери библиотеку из этого списка, не добавляй конкурирующую (напр. не тащить redux/zustand поверх react-query, formik, moment, другой HTTP-клиент вместо axios).

- **Платформа**: Expo ~56, режим prebuild / CNG, `expo-dev-client`; OTA-обновления через `expo-updates` + EAS. Язык — TypeScript (strict).
- **Папки `android`/`ios` НЕ закоммичены** (обе в `.gitignore`) — они генерируются `expo prebuild` из `app.config.js` при сборке. Правки нативной конфигурации (permissions, intent-filters, entitlements, Info.plist) вноси только в `app.config.js` или в config-плагин в `plugins/`: изменения прямо в `android/`/`ios/` никуда не доедут и будут затёрты следующим prebuild.
- **Навигация**: React Navigation — `native-stack` + `drawer`.
- **Серверные данные**: TanStack React Query; кэш персистится в AsyncStorage (`query-persist-client-core` + `query-async-storage-persister`). HTTP — `axios`.
- **Локальная БД / оффлайн**: Drizzle ORM поверх `expo-sqlite` (рантайм); `drizzle-kit` — миграции; `better-sqlite3` — только в тестах.
- **Хранилища (не путать)**: AsyncStorage — кэш react-query и простые KV; `expo-secure-store` — секреты/токены; `expo-sqlite`/Drizzle — оффлайн-зеркало данных.
- **i18n**: `i18next` + `react-i18next`.
- **Аутентификация**: Google (`@react-native-google-signin`), Apple (`expo-apple-authentication`), биометрия — `expo-local-authentication`.
- **UI**: `react-native-reanimated` (+ `react-native-worklets`), `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `expo-image`, `react-native-render-html`. Тосты — `react-native-toast-message` (через него работает `showErrorToast`).
- **Карты**: MapLibre (`@maplibre/maplibre-react-native`).
- **Медиа/файлы/гео**: `expo-audio`, `expo-image-picker` / `expo-image-manipulator`, `expo-file-system`, `expo-sharing`, `expo-location`.
- **Пуши**: `expo-notifications`.
- **Мониторинг/аналитика**: Sentry (`@sentry/react-native`), Firebase Analytics.

## Правила кода

- **TypeScript strict** включён (`tsconfig.json`) — не ослаблять, без неявного `any`.
- **ESLint**: `no-unused-vars` = error; для намеренно неиспользуемого — префикс `_` (`_arg`). Не глушить правила через `// eslint-disable` без причины.
- **Нет `exhaustive-deps`**: массивы зависимостей `useEffect`/`useMemo` курируются вручную (напр. `hooks/useItem.ts` намеренно опускает `showErrorToast`) — не «чинить» deps вслепую.
- **i18n**: все пользовательские строки только через i18next (`useTranslation` / `i18n.t`), включая тексты ошибок — без хардкода. Ключи flat snake_case в `locales/en.json` + `locales/ru.json` (держать в паре). После добавления строк — `npm run i18n:extract`.
- **Динамические ключи i18n**: `i18next-parser` видит только литеральные `t("...")`, поэтому ключ, собираемый в рантайме (`t(RANK_TITLE_KEY[rank])`, `t(occurrence.key)`, `t(group.labelKey)`, ключ из ответа бэка), для экстрактора не существует. Удалить его он больше не может (см. ниже), но и `npm run i18n:unused` покажет такой ключ мёртвым. Заводя его, перечисли **все** варианты комментарием в самом низу файла, где он резолвится (парсер вычитывает `t()` и из комментариев): блок `// t("country_status_endemic")` по строке на вариант — см. `util/taxonomy.ts`, `components/Taxonomy/taxonTraitConfig.ts`, `components/Main/BirdOfTheDay.tsx`.
- **`npm run i18n:extract` только добавляет ключи и идемпотентен.** Так настроено намеренно (`keepRemoved` + `createOldCatalogs: false`, разбор причин — в шапке `i18next-parser.config.js`): раньше команда молча удаляла динамические ключи, воскрешала мёртвые из `locales/*_old.json` и затирала живой перевод пустой строкой оттуда же. Архивных `*_old.json` в репозитории больше нет, заводить их обратно нельзя. Обратная сторона: неиспользуемые ключи теперь копятся — найти их можно `npm run i18n:unused` (только печатает, ничего не удаляет), удалять руками и осознанно.
- **Пустых значений (`"key": ""`) в `en.json`/`ru.json` быть не должно**: пустая строка — валидный перевод, она победит фолбэк, и в UI будет пусто.
- **Плюрализация**: ключ, который вызывается с `count`, задавай сразу всеми формами CLDR — `_one`/`_other` для en и `_one`/`_few`/`_many`/`_other` для ru (`compatibilityJSON: "v4"`), без базового ключа. Базовый ключ работает только через фолбэк, а экстрактор всё равно допишет рядом пустые формы. См. `species_catalog_count` в `locales/ru.json`.
- **React Query**: включай `language` в query-key, когда сервер локализует ответ, иначе при `staleTime` = сутки отдаётся устаревшая языковая версия. См. `hooks/useItem.ts`, `hooks/Diary/useOfflineDiary.ts`.
- **Безопасный доступ к `data` ответа**: не обращайся к вложенным полям одиночным `?.` — `data?.a.b` всё равно падает, если `a` пусто. Ответ бывает частичным (напр. `{ redirect }` при межъязыковой ссылке на таксон — без `multilangs`/`countries`/`parents`) или устаревшим из offline-кэша, а `useMemo`/`useEffect` выполняются до ранних `return` по `!data`/`data.redirect`. Прокидывай `?.` до конца цепочки (`data?.a?.b`) и давай фолбэк (`?? {}` / `?? []`). Полагаться на вложенные поля без `?.` можно только после ранних `return`.
- **Ошибки**: не вызывать `Sentry.captureException` вручную и не глушить пустым `catch`. Ошибки идут через `services/errors.ts` (`normalizeApiError`) и тост `showErrorToast` (`hooks/useApiError.ts`). Мутации — через `useMutationWithTranslation` (авто-тост, кроме 400-валидации).
- **Offline-first сущности** (Diary/Observation/Place): репозиторий в `hooks/repositories/` + зеркало в Drizzle. Паттерны: negative temp id (`nextTempId()`), `client_request_id` для идемпотентности, `db.transaction` для мульти-записи, overlay для склейки локальных изменений. Не изобретать заново.
- **Тесты**: colocated `__tests__/`, файлы `.test.tsx`; `jest-expo` + `@testing-library/react-native`. Для hook-тестов React Query — реальный `QueryClient` (retry off), а не мок react-query. Репозитории — тестовая БД через `hooks/repositories/testDb.ts` (`services/db/client` глобально замокан в `jest.setup.js`).

## Бэкенд

- Django-бэкенд лежит в отдельном репозитории: `/Users/esculapweb/Py/dibird`.
- **Перед любыми правками бэкенда прочитай `/Users/esculapweb/Py/dibird/CLAUDE.md`** — там стек, команды и конвенции бэка (в эти сессии он не подгружается автоматически, т.к. репозиторий вне рабочей папки).
- manage.py-команды запускаются через docker: `docker compose exec web ...` из `docker/dibird_local` (не host python).
