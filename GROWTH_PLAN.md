# План: сделать DiBird конкурентным (рост, удержание, рейтинги)

> Живой документ: отмечайте статус фаз по ходу работы, как это сделано в
> `TAXONOMY_CATALOG_STATUS.md`. Создан 2026-07-22.

## Context

**Зачем.** DiBird — зрелое birdwatching-приложение (наблюдения, дневники, места,
лайфлист/статистика, рейтинги, сообщество, каталог видов с голосами, push-алерты
о редких птицах рядом, оффлайн-синк). Технически оно уже сильнее многих
конкурентов, но продуктовая обвязка вокруг него отсутствует: нет гостевого
режима, онбординга, достижений, шеринга, запроса оценки, и — главное — почти нет
аналитики, поэтому непонятно, где именно теряются пользователи.

**Вводные от владельца:** соло-разработчик, без бюджета; приложение остаётся
бесплатным (рост важнее выручки); целевые рынки — все (EN-глобальный, RU,
не-EN Европа, Латам/Азия); узкое место неизвестно → план начинается с
инструментовки.

**Что уже есть (проверено в коде) — на этом строится план:**

| Актив | Где | Как используем |
|---|---|---|
| Каталог видов/территории/поиск на бэке не требуют аккаунта (`IsFromApp`, не `IsAuthenticated`) | `/Users/esculapweb/Py/dibird/app/api/views.py` | гостевой режим стоит дёшево |
| Алерты о редких птицах рядом (радиус, порог редкости, часы, watchlist, лимит в день) | [services/alertSettings.ts](services/alertSettings.ts), `myapi/services/ebird_adapter.py` | главное УТП, сейчас спрятано |
| Импорт наблюдений из eBird на уровне модели (`external_source`/`external_id`/`external_username`) | `myapi/models.py:247-270` | switching-фича «уйти от конкурента» |
| Названия видов на 50-70 языках, синонимы, протонимы | [screens/SpeciesDetailScreen.tsx](screens/SpeciesDetailScreen.tsx) | УТП для не-EN рынков |
| Голоса видов (`expo-audio`) | [components/Taxonomy/TaxonSoundRow.tsx](components/Taxonomy/TaxonSoundRow.tsx) | база для тренажёра голосов |
| Оффлайн-first (SQLite + drizzle + очередь синка) | [services/sync/](services/sync/), [hooks/repositories/](hooks/repositories/) | УТП в сторе |
| Push-инфраструктура + типы уведомлений (`notable_obs`, `watchlist_activity`, `achievement`, `checklist`) | [hooks/usePushNotifications.ts](hooks/usePushNotifications.ts), `myapi/models.py:451` | retention-петли |
| Celery + Redis на бэке | `app/requirements/base.txt` | дайджесты, отложенные джобы |
| Deep links + `applinks:dibird.com`, публичный веб-сайт | [linking.ts](linking.ts), [app.config.js](app.config.js), `/Users/esculapweb/Py/dibird/app/web/` | web-to-app, шеринг |
| Сильный релизный гейт (tsc/eslint/jest/Maestro в CI) | [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md), [bitbucket-pipelines.yml](bitbucket-pipelines.yml) | качество = рейтинги |

**Дыры (тоже проверено):**

- Приложение **полностью за логином** — [navigation/AuthStack.tsx](navigation/AuthStack.tsx) содержит только Welcome/Login/Signup.
- Аналитика — только `login`, `sign_up`, `screen_view` ([util/auth.ts:33](util/auth.ts#L33), [navigation/Navigation.tsx:149](navigation/Navigation.tsx#L149)). Воронки и retention-событий нет.
- [screens/AchievementsScreen.tsx](screens/AchievementsScreen.tsx) — заглушка `<Text>AchievementsScreen</Text>`, хотя роут ([navigation/AppStack.tsx:380](navigation/AppStack.tsx#L380)) и push на него уже есть.
- Нет онбординга: [screens/WelcomeScreen.tsx](screens/WelcomeScreen.tsx) — сразу Apple/Google/Login.
- Нет запроса оценки в сторе (`expo-store-review` не установлен).
- Нет шеринга: `expo-sharing` используется только для GDPR-экспорта ([hooks/Profile/useExportProfile.ts](hooks/Profile/useExportProfile.ts)).
- Нет фото в наблюдениях — ни на фронте ([components/Observation/ObservationForm.tsx](components/Observation/ObservationForm.tsx)), ни в модели `Observation`.
- Нет ID по фото/звуку (killer-фича Merlin) — сознательно **не делаем** в этом плане, см. «Что не делаем».

**Целевой результат за 6 месяцев:** измеримая воронка; install→signup ≥ 25%,
signup→первое наблюдение ≥ 60%, D7 ≥ 20%, D30 ≥ 10%, рейтинг ≥ 4.5 при
≥ 100 оценках, доля органики через шеринг/веб ≥ 20% установок.

---

## Фаза 0 (нед. 1-2) — Инструментовка: без неё всё остальное вслепую

> **Статус: сделана в урезанном виде (26.07).** `services/analytics.ts` есть,
> существующие вызовы переведены, воронка и user properties размечены. Из
> списка ниже сознательно не заводились `onboarding_step`,
> `alerts_enabled`, `import_started` — соответствующих фич пока нет, и событие
> под несуществующий экран всё равно пришлось бы переписывать. Вместо
> `species_viewed{source}` заведено отдельное `deep_link_opened{screen, authed}`:
> на самом экране источник неотличим (дерево / поиск / ссылка), а в `linking.ts`
> он известен точно. Пункты 4 и 5 (консоли, Sentry-алерт) — не код, за вами.

**Файлы:** новый `services/analytics.ts`; правки [util/auth.ts](util/auth.ts),
[navigation/Navigation.tsx](navigation/Navigation.tsx),
[screens/ObservationEditorScreen.tsx](screens/ObservationEditorScreen.tsx),
[screens/WelcomeScreen.tsx](screens/WelcomeScreen.tsx).

1. `services/analytics.ts` — тонкая типизированная обёртка над уже подключённым
   `@react-native-firebase/analytics` (`logEvent(getAnalytics(), …)` сейчас
   вызывается напрямую в двух местах). Один union-тип событий + один `track()`,
   чтобы имена не расползались. Существующие вызовы в `util/auth.ts` и
   `Navigation.tsx` перевести на него, не меняя имена событий (`login`,
   `sign_up`, `screen_view` — стандартные для Firebase, ломать нельзя).
2. Добавить события воронки:
   `welcome_viewed` → `auth_started{method}` → `sign_up` → `onboarding_step{n}` →
   `onboarding_completed` → `first_observation_created` → `observation_created`
   → `alerts_enabled` → `push_permission{granted}` → `location_permission{granted}`
   → `species_viewed` → `share_tapped{type}` → `import_started/finished`.
3. `user_property`: страна, язык интерфейса, есть ли пуш-токен, размер лайфлиста
   (бакеты 0/1-10/11-100/100+), guest vs registered. По ним режутся все отчёты.
4. В Firebase Console: собрать funnel `first_open → sign_up →
   first_observation_created`, cohort-отчёт D1/D7/D30. В Play Console включить
   бесплатные **store listing experiments** (A/B иконки и скриншотов), в
   App Store Connect — **Product Page Optimization** (тоже бесплатно).
5. Sentry уже подключён ([services/sentry.ts](services/sentry.ts)) — завести
   алерт на рост crash-free < 99.5% и следить за ним как за релизным гейтом.

**Проверка:** DebugView в Firebase — прогнать сценарий «чистая установка →
регистрация → первое наблюдение» на симуляторе, убедиться, что все события
приходят с нужными параметрами.

---

## Фаза 1 (нед. 3-6) — Убрать трение на входе: гостевой режим + онбординг

Это самая крупная известная утечка: между установкой и регистрацией пользователь
не видит **ничего** ценного.

### 1.1 Гостевой режим («Смотреть без регистрации») — **СДЕЛАНО (26.07)**

Бэк отдаёт каталог без аккаунта (`IsFromApp`), поэтому это была работа только
на фронте. Что вышло на практике:

- **`publicEndpoints` трогать не понадобилось.** Пункт плана был неверен:
  [services/api.ts:180](services/api.ts#L180) этим списком лишь отключает
  *подстановку* заголовка, а запрос не блокирует — каталожные ручки и так
  уходили без токена. Реальная работа оказалась в навигации и `linking.ts`.
- **Экранов не 3, а 7.** К моменту реализации каталог вырос: `Taxonomy`,
  `TaxonGroupDetail`, `SpeciesDetail`, `SpeciesCompare`, `TerritoryList`,
  `TerritoryDetail`, `TerritoryCompare`. Ни один не читает профиль, поэтому
  условный рендер не понадобился. Они вынесены в общий `CatalogParamList`
  (`types.ts`) и регистрируются одним списком
  [navigation/catalogScreens.tsx](navigation/catalogScreens.tsx) в обоих стеках.
  Навигация внутри группы типизируется `CatalogNavigationProp` — так уход в
  личный экран становится ошибкой компиляции, а не падением у гостя.
- **Точки входа**: кнопка «Посмотреть птиц мира» на
  [screens/WelcomeScreen.tsx](screens/WelcomeScreen.tsx) и два пункта в drawer
  гостевого стека, зеркально бургер-меню залогиненного.
- **Мягкий upsell**: [hooks/useRequireAuth.ts](hooks/useRequireAuth.ts) со
  шторкой через [services/bottomSheet.ts](services/bottomSheet.ts). Точка
  вызова в этом объёме ровно одна — «добавить наблюдение» на странице вида;
  остальные переходы каталога никуда за его пределы не ведут.
- **Деп-линки открываются без аккаунта** ([linking.ts:276](linking.ts#L276)):
  условие `isAuthenticated` снято, у гостя маршрут строится под `Welcome`
  вместо `Main`. Это чинит уже отгруженный шеринг — до этого ссылка,
  отправленная незарегистрированному, уезжала на сайт.
- **Один блокер оказался на бэке-стороне**: вкладка «По группам» на странице
  страны ходила в `/myapi/checklist2/`. Переведена на публичную
  `/api/checklist/` (`fetchTerritoryTree` в [util/fetches.ts](util/fetches.ts),
  адаптер формы + подсчёт видов в группах на клиенте). Заодно закрыт открытый
  пункт `TAXONOMY_CATALOG_STATUS.md` про холостой `seen`-подзапрос.
- **401 у гостя** больше не идёт в бессмысленный refresh
  ([services/api.ts:229](services/api.ts#L229)).

Даёт: ASO-трафик перестаёт отваливаться на стене логина; App Review это любит;
deep-link на вид из шеринга работает для незарегистрированных.

### 1.2 Онбординг (3 экрана + первый успех)

Новый `screens/OnboardingScreen.tsx` + флаг в
[util/storageHelper.ts](util/storageHelper.ts):

1. Ценность: «Веди лайфлист. Получай алерты о редких птицах рядом. Работает
   без сети.» — по одному экрану на пункт, с реальными скриншотами.
2. Выбор страны (переиспользовать `CountriesDropdown` из
   [hooks/useDropdownQuery.ts](hooks/useDropdownQuery.ts)) → сразу показать
   «в вашей стране N видов, вы отметили 0» — мгновенная персонализация.
3. **Первое наблюдение за 30 секунд**: экран «Кого вы видели сегодня?» со
   списком самых частых видов региона (эндпоинт `territory-species` уже есть),
   тап → наблюдение создано с гео-местом по умолчанию. Переиспользовать
   логику [components/Main/QuickActions.tsx](components/Main/QuickActions.tsx).

**Разрешения — только в контексте, не на старте:** гео просить на шаге выбора
места, пуши — сразу после включения алертов (сейчас
[hooks/usePushNotifications.ts](hooks/usePushNotifications.ts) регистрируется по
входу). Это заметно поднимает opt-in rate, а он напрямую кормит retention.

### 1.3 ASO (бесплатно, но требует времени)

- Подзаголовок/короткое описание вокруг запросов, где конкуренты слабы:
  *bird life list, birding log, rare bird alerts, bird checklist offline*;
  RU: *определитель птиц, дневник наблюдений, орнитология*.
- Локализовать листинги стора хотя бы под ru/en/de/es/pt — переводы названий
  видов на 50-70 языков уже есть, это реальный аргумент в описании.
- Скриншоты: 1-й — алерт о редкой птице, 2-й — лайфлист/статистика,
  3-й — каталог вида с голосом, 4-й — оффлайн, 5-й — рейтинг/сравнение.

---

## Фаза 2 (нед. 5-10) — Отличие от конкурентов: почему уходить от eBird/Merlin

### 2.1 Импорт лайфлиста из eBird — главная switching-фича

Люди не уходят от конкурента, потому что «там 10 лет данных». Модель уже
готова: `Observation.external_source = "ebird"`, `external_id` (unique),
`external_username` (`myapi/models.py:247-270`), есть
`myapi/services/ebird_adapter.py`.

- **Бэк:** эндпоинт `POST /myapi/observation-import/` — приём CSV
  «Download My Data» из eBird, парсинг в celery-задаче, мэппинг по
  `species_code` на `Taxon`, идемпотентность через `external_id`, отчёт
  «импортировано N, не распознано M». Класть рядом с существующим адаптером.
- **Фронт:** `screens/ImportScreen.tsx` — выбор файла, прогресс, результат;
  точка входа в [screens/SettingsScreen.tsx](screens/SettingsScreen.tsx) **и**
  в онбординг («уже ведёте список в eBird? перенесите за минуту»).
- Позже тем же механизмом — Observation.org и BirdLasser.

### 2.2 Вытащить алерты о редких птицах на первый план

Фича уже построена и полностью настраиваема
([screens/AlertSettingsScreen.tsx](screens/AlertSettingsScreen.tsx)), но
пользователь о ней не узнаёт. Это ровно то, за что в других приложениях платят.

- Шаг онбординга «Включить алерты» с картой радиуса.
- Карточка на главной ([screens/MainScreen.tsx](screens/MainScreen.tsx), рядом с
  `RareNearby`): «Алерты выключены — включить», если `is_enabled === false`.
- Первый скриншот в сторе + первая строка описания.

### 2.3 Тренажёр голосов (дёшево, вирусно, уникально)

`expo-audio` и `TaxonSoundRow` уже работают, звуки отдаёт бэк. Новый
`screens/SoundQuizScreen.tsx`: 10 вопросов «чей голос?» из видов вашего региона,
счёт, шеринг результата. Даёт причину открывать приложение дома (а не только в
поле), а это и есть недостающая частота использования. Никакого ML не требуется.

---

## Фаза 3 (нед. 8-14) — Удержание

1. **Достижения** — [screens/AchievementsScreen.tsx](screens/AchievementsScreen.tsx)
   заглушка, при этом бэк уже умеет тип уведомления `achievement`, а
   [hooks/usePushNotifications.ts:26](hooks/usePushNotifications.ts#L26) уже
   роутит push на этот экран с `highlightId`. Реализовать:
   - бэк: модель `Achievement`/`ProfileAchievement` + правила (первые 10/50/100/
     250/500 видов, 7 дней подряд, 5 стран, все виды семейства, ночная птица,
     редкая птица) — считать в celery по сигналу создания наблюдения
     (`myapi/signals.py` уже есть);
   - фронт: сетка бейджей, прогресс «до следующего — 3 вида», подсветка по
     `highlightId`, шеринг бейджа.
   - Ключевой приём: **всегда показывать ближайшую недостигнутую цель** — именно
     она возвращает пользователя.
2. **Стрики и годовой челлендж** — «Year list 2026», «месяц миграции», прогресс
   на главной рядом с `ChecklistHero`. Сезонность birdwatching (весна/осень) —
   бесплатный повод для пушей.
3. **Weekly digest push** (celery, воскресенье вечером): «за неделю вы отметили
   12 видов, 2 новых; в вашем радиусе видели 5 редких». Уважать
   `active_hours_utc` и `max_alerts_per_day` из `AlertSettings`.
4. **Реактивация** — пуш на 3-й и 14-й день молчания, привязанный к событию
   («рядом видели X, которого нет в вашем списке»), а не «мы скучаем».
5. **Соцпетля** — `CommunityScreen` и `RatingsCompareScreen` уже есть; добавить
   подписки на пользователей и уведомление «друг обогнал вас в рейтинге».

---

## Фаза 4 (нед. 12-18) — Виральность и бесплатный трафик

1. **Шеринг-карточки.** Плумбинг уже есть и работает: `util/taxonShareLink.ts`,
   кнопки «поделиться» на шести экранах каталога, разбор ссылок в
   [linking.ts](linking.ts), и с 26.07 ссылка открывается в приложении **и у
   получателя без аккаунта** (см. 1.1). Осталась только картинка: бэк генерит
   OG-изображение (Django уже рендерит веб), приложение шерит
   `https://dibird.com/s/<token>`. Типы: лайфлист года, новый вид, достижение,
   результат квиза.
2. **Web-to-app.** На публичных страницах видов/территорий — Smart App Banner
   (iOS, одна meta-строка) и баннер «открыть в приложении» (Android). Веб уже
   SEO-индексируется и уже отдаёт нужные данные.
3. **«Сравнись со мной»** — ссылка на `RatingsCompareScreen` с вашим профилем;
   получатель без аккаунта видит превью (гостевой режим из фазы 1) и ставится
   перед понятной причиной зарегистрироваться.
4. **Сообщества** — точечно, руками: r/birding, RU-группы орнитологов,
   локальные birding-клубы в не-EN Европе, где eBird не локализован. Аргумент —
   мультиязычность и алерты, а не «ещё одно приложение».

---

## Фаза 5 (параллельно, с нед. 6) — Высокие оценки в сторах

1. **`expo-store-review`** (добавить в зависимости) — запрос **в момент успеха**,
   не по расписанию: после получения достижения, после 3-го наблюдения, после
   первого сработавшего алерта. Условия: ≥ 3 сессии, нет крэша в этой сессии,
   не чаще 1 раза в 120 дней (флаг в [util/storageHelper.ts](util/storageHelper.ts)).
2. **Pre-prompt** «Нравится DiBird?»: «Да» → системный
   `requestReview()`; «Не очень» → `openSupportEmail()`
   ([util/openSupportEmail.ts](util/openSupportEmail.ts) уже есть). Так
   негатив уходит в почту, а не в стор.
3. **Отвечать на все отзывы** в обеих консолях в течение 48 часов — это само по
   себе поднимает средний балл (люди правят оценки).
4. **Качество как гейт:** cold start, отсутствие ANR, crash-free ≥ 99.5%.
   [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) уже жёсткий — добавить в него
   пункт «просмотреть Sentry за неделю до релиза».

---

## Что сознательно не делаем

- **ID по фото/звуку** (Merlin/BirdNET) — требует GPU-инференса и датасетов;
  для соло без бюджета это поглотит все 6 месяцев и всё равно проиграет
  Cornell. Вместо этого — тренажёр голосов (2.3) и импорт из eBird (2.1).
- **Фото в наблюдениях** — нужны модель, S3-хранилище, модерация и деньги за
  трафик. Отложить до момента, когда появится монетизация; сейчас это не
  причина установки.
- **Новости/глобальный поиск** (Приоритет 3 из
  [TAXONOMY_CATALOG_STATUS.md](TAXONOMY_CATALOG_STATUS.md)) — полезно, но
  на воронку не влияет; делать после фазы 2. Поиск по названию видов в
  каталоге уже есть, отдельный глобальный для гостевого режима не понадобился.
  **Территории** этот пункт больше не касается: Приоритет 2 сделан 24-26.07 и
  вошёл в гостевой режим — три экрана стран доступны без аккаунта.

---

## Порядок работ (короткая версия)

1. ~~Фаза 0 (аналитика)~~ — сделана 26.07 в урезанном виде, см. выше.
2. ~~Гостевой режим (1.1)~~ — сделан 26.07, одним релизом с аналитикой.
   Осталось от пункта: онбординг (1.2) и запрос оценки (5.1-5.2).
3. Алерты на первый план + ASO (2.2, 1.3) — маркетинговый релиз.
4. Импорт из eBird (2.1).
5. Достижения + стрики + дайджест (3.1-3.3).
6. Шеринг-карточки + web-to-app (4.1-4.2).
7. Тренажёр голосов (2.3) — когда нужен инфоповод/всплеск.

---

## Верификация

**Код (каждый шаг):**
```bash
npm run check          # tsc --noEmit && eslint .
npm run test           # jest, включая repository-слой
npm run e2e            # Maestro, iOS
npm run e2e:android
```
Новые экраны покрывать тестами по образцу
[screens/__tests__/SpeciesDetailScreen.test.tsx](screens/__tests__/SpeciesDetailScreen.test.tsx)
— в проекте каждый экран покрыт, новые не должны быть исключением.

**Фаза 0:** Firebase DebugView — сценарий «чистая установка → регистрация →
первое наблюдение», все события с параметрами на месте.

**Фаза 1:** отдельный Maestro-флоу `.maestro/guest-browse.yaml` — запуск без
логина → каталог → вид → попытка «отметить увиденным» → шторка регистрации.
Метрика: install→signup и signup→first_observation в Firebase-воронке
до и после релиза.

**Фаза 2:** импорт проверять на реальном eBird-CSV (экспорт тестового
аккаунта); повторный импорт того же файла не должен создавать дубли
(`external_id` unique). Бэк-команды — через
`docker compose exec web ...` из `docker/dibird_local`.

**Фаза 3-5:** пуши — через существующий `myapi/management/commands/test_push.py`;
достижения — проверить, что push с `screen: "Achievements"` открывает экран с
подсветкой (`handleNotificationNavigation` уже это умеет); запрос оценки — в
sandbox-сборке через флаг, чтобы не сжечь лимит системного диалога.

**Метрики-гейты по фазам:** Фаза 1 — install→signup ≥ 25%; Фаза 2 —
доля пользователей с включёнными алертами ≥ 40%; Фаза 3 — D7 ≥ 20%;
Фаза 4 — ≥ 20% установок из шеринга/веба; Фаза 5 — рейтинг ≥ 4.5.
