# Управление аккаунтом в приложении

> Живой документ. Создан 2026-08-31 после сверки меню аккаунта на сайте с тем,
> что умеет приложение. Этапы 1–4 сделаны в тот же день; «Прочие пробелы» в
> конце — очередь.

## Контекст

Всё, что связано с учётной записью сложнее правки имени и страны, живёт только
на сайте — в шаблонах allauth. Приложение умеет войти, зарегистрироваться,
подтвердить почту и удалить аккаунт; всё остальное человек может сделать только
открыв dibird.com в браузере.

Меню аккаунта на сайте (`myweb/templates/myweb/base/base.html:60-110`) против
приложения:

| Пункт сайта | URL | В приложении |
|---|---|---|
| My Dibird | `/my/` | ✅ Main |
| My profile | `/my/profile/` | ✅ [ProfileScreen.tsx](screens/ProfileScreen.tsx) |
| Attached accounts | `/accounts/3rdparty/` | ❌ |
| Change email (список / добавить / удалить / сделать основным / переслать) | `/accounts/email/` | ❌ |
| Change Password | `/accounts/password/change/` | ❌ |
| Forgot Password? (со страницы входа) | `/accounts/password/reset/` | ❌ |
| Set Password (для входивших только соцсетью) | `/accounts/password/set/` | ❌ |
| Re-send Verification | кнопка в `account/email.html` | ❌ |
| Delete account | `/my/delete-account/` | ✅ Settings → danger |
| Sign Out | | ✅ |

Приложение вдобавок нигде не показывает email пользователя — при том, что
удаление профиля требует его ввести по памяти.

### Что уже готово в API и не используется

- `POST /api-auth/password/reset/` и `/api-auth/password/reset/confirm/`
- `POST /api-auth/password/change/`
- `POST /api-auth/registration/resend-email/`
- `GET /myapi/profile/social/` — список привязанных соцаккаунтов, написан
  (`myapi/views.py`, action `social_accounts`), приложением не вызывается ни разу

### Чего нет и в API

- Управление email — только веб-вью allauth, нужен свой viewset.
- Привязка/отвязка соцаккаунта — но dj-rest-auth 7.2 уже содержит
  `SocialConnectView`, `SocialAccountListView` и `SocialAccountDisconnectView`.
  Их надо только подключить в urls. Осторожно: disconnect зовёт
  `validate_disconnect`, а в allauth 65 этот метод — **пустая заглушка**
  (проверено в контейнере), так что защиту «останется ли чем войти» пишем сами.

### Баг, из-за которого этап 1 нельзя было просто «подключить» (исправлен)

`POST /api-auth/password/reset/` отдавал **500** для существующего пользователя.
`dj_rest_auth.forms.default_url_generator` делает
`reverse('password_reset_confirm', ...)`, а такого имени в urlconf проекта нет —
allauth называет свой роут `account_reset_password_from_key`. Проверено на живом
контейнере: `reverse('password_reset_confirm')` → `NoReverseMatch`. Пока не
задан свой `PASSWORD_RESET_SERIALIZER` с `url_generator`, сброс пароля через API
не работал вообще — ни из приложения, ни откуда-либо ещё. Регрессия закрыта
тестом `test_letter_carries_a_link_the_app_can_open`.

---

## Этап 1. Сброс пароля («забыл пароль») — **СДЕЛАНО (31.08)**

**Бэкенд** (`/Users/esculapweb/Py/dibird`):

- `myapi/serializers.py` — `CustomPasswordResetSerializer(PasswordResetSerializer)`
  с `get_email_options() → {'url_generator': ...}`, строящим
  `{BASE_URL}/accounts/password/reset/key/{uid}-{token}/`. Тем же приёмом, что
  уже применён в `web/adapter.py:get_email_confirmation_url`. Прописать в
  `REST_AUTH['PASSWORD_RESET_SERIALIZER']`.
- `web/static/web/well-known/apple-app-site-association` —
  `/accounts/password/reset/key/*` и русский двойник.
- Регрессионный тест: `/api-auth/password/reset/` отвечает 200 и письмо
  содержит ссылку (ловил бы `NoReverseMatch`).

**Приложение**:

- `app.config.js` — `/accounts/password/reset/key/` в `APP_LINK_PATHS`.
- `linking.ts` — в `GUEST_SCREENS`
  `ResetPassword: "accounts/password/reset/key/:key"`, параметр режется на
  `uid`/`token` **по первому дефису**: сам токен тоже содержит дефис.
- Экраны `ForgotPasswordScreen` (email → `POST /api-auth/password/reset/`) и
  `ResetPasswordScreen` (новый пароль → `.../confirm/` с `uid`/`token`), оба в
  `AuthStack`. Верстка и валидация — из `components/Auth/AuthForm.tsx`, разбор
  ошибок — `useApiError` + `extractApiError` по образцу `AuthContent.tsx`.
- Ссылка «Забыли пароль?» под формой входа в `AuthContent`.
- Экран «письмо отправлено» — режим у существующего `CheckEmailScreen`.

Ссылка из письма открывается и в браузере (веб-вью allauth принимает тот же
URL), так что фолбэк для устройств без приложения достаётся бесплатно.

## Этап 2. Смена/установка пароля и повторное письмо — **СДЕЛАНО (31.08)**

- `REST_AUTH['OLD_PASSWORD_FIELD_ENABLED'] = True` — сейчас смена пароля не
  требует старого, а для приложения с долгоживущим refresh-токеном это лишнее.
- `has_usable_password` в `ProfileSerializer`: без него приложение не отличит
  «сменить пароль» от «задать пароль» для входивших только через Google/Apple.
  Для них `old_password` не запрашивается.
- `ChangePasswordScreen` в Settings → «Безопасность». Секция сейчас целиком
  завёрнута в `bioAvailable &&` (`SettingsScreen.tsx`) — расцепить, чтобы она
  рисовалась и без биометрии.
- Кнопка «Отправить письмо ещё раз» на `CheckEmailScreen` →
  `POST /api-auth/registration/resend-email/`.

## Этап 3. Управление email — **СДЕЛАНО (31.08)**

**Бэкенд**: `EmailAddressViewSet` в `myapi/views.py`, `router.register(r'emails')`:

- `GET /myapi/emails/` — список (`id`, `email`, `verified`, `primary`)
- `POST /myapi/emails/` — добавить (`EmailAddress.objects.add_email(..., confirm=True)`)
- `DELETE /myapi/emails/<pk>/`
- `POST /myapi/emails/<pk>/set-primary/`
- `POST /myapi/emails/<pk>/resend/`

Запреты те же, что у веб-формы: нельзя удалить основной и нельзя удалить
последний; основным можно сделать только подтверждённый.

**Приложение**: `EmailsScreen` (Settings → новая секция «Аккаунт»), список с
бейджами «Основной / Подтверждён / Не подтверждён», на компонентах
`Row`/`Section` из `SettingsScreen`.

Отдельная деталь: письмо подтверждения ведёт на `/accounts/confirm-email/<key>/`,
а экран `ConfirmEmail` объявлен **только в `AuthStack`**. Добавив второй адрес
из-под авторизации, человек по ссылке из письма попадёт в никуда. `ConfirmEmail`
нужен и в `AUTHED_SCREENS`, с переходом после успеха на `Emails`, а не на
`Login`.

## Этап 4. Привязанные аккаунты — **СДЕЛАНО (31.08)**

**Бэкенд** — почти только urls:

- `GoogleConnect`/`AppleConnect` — подклассы `SocialConnectView` с теми же
  адаптерами, что у существующих `GoogleLogin`/`AppleLogin`, на
  `/auth/google/connect/` и `/auth/apple/connect/`.
- `SocialAccountDisconnectView` на `/myapi/social-accounts/<pk>/disconnect/`.
- В `SocialAccountSerializer` добавить `id` — сейчас его нет, а он нужен как
  цель для disconnect.

**Приложение**: `LinkedAccountsScreen`. Для привязки нужен небольшой рефакторинг
`util/auth.ts`: из `LoginWithGoogle`/`LoginWithApple` вынести получение токенов
провайдера отдельно от `post(...) + saveTokens(...)`, чтобы те же токены можно
было отправить на connect-эндпоинт, не трогая текущую сессию.

## Что вылезло по дороге и учтено

- **`validate_disconnect` в allauth 65 — пустая заглушка.** Из коробки
  `SocialAccountDisconnectView` (и форма на сайте) дали бы человеку, заведённому
  через Google, снять единственную привязку и остаться без входа совсем.
  Проверка написана в `CustomSocialAccountAdapter` — общая для сайта и API.
- **Ссылку подтверждения второго адреса открывает уже вошедший человек.**
  `ConfirmEmail` пришлось объявить и в `AUTHED_SCREENS`, и подкладывать под него
  `Main`: иначе экран становился корнем стека и «назад» из списка адресов вело
  на израсходованное подтверждение.
- **Привязка провайдера ловилась воротами согласия с условиями.**
  `pre_social_login` отвечал 403 на каждый connect, потому что в этом потоке
  `sociallogin.user` — ещё не сохранённый пользователь. Добавлена ветка на
  `AuthProcess.CONNECT`.
- **`client_id` Apple выбирался по концу пути** (`endswith("/auth/apple")`), из-за
  чего `/auth/apple/connect/` получил бы веб-клиент и упал на проверке audience.
- **`has_usable_password` намеренно не кладётся в SQLite-зеркало профиля**:
  пароль можно задать на сайте, и устаревшая локальная копия отправляла бы
  человека не в ту форму. Экраны читают флаг с сервера.
- **Предупреждение dj-rest-auth** (`AUTHENTICATION_METHOD is deprecated`)
  всплывает на каждом сбросе пароля; кода проекта там нет, погашено точечным
  фильтром в `pytest.ini`.

## Верификация

- Приложение: `npm run check` (чисто), `npm test` — 239 наборов, 3289 тестов
  зелёные. Новое покрыто: `screens/__tests__/PasswordResetScreens.test.tsx`,
  `ChangePasswordScreen.test.tsx`, `EmailsScreen.test.tsx`,
  `LinkedAccountsScreen.test.tsx`, разбор ссылки — в `linking.deeplinks.test.ts`,
  вызовы API — в `util/__tests__/auth.test.ts`.
- Бэкенд: `docker/dibird_local/check.sh` — 3455 тестов, покрытие 84,0%. Новое:
  `myapi/tests/test_password_api.py`, `test_emails_api.py`,
  `test_social_accounts_api.py`.
- **Осталось руками** (машинам недоступно): прогон deep link'а сброса пароля на
  устройстве по настоящей ссылке из mailpit —
  `xcrun simctl openurl booted "<url>"` /
  `adb shell am start -a android.intent.action.VIEW -d "<url>"`; привязка
  Google/Apple (нужны живые SDK и аккаунты провайдеров); проверка, что
  `apple-app-site-association` с новым путём доехал на прод.

## E2E

Четыре флоу, состав и разбор — в `RELEASE_CHECKLIST.md` §1 (таблица) и §2:
`account-forgot-password`, `account-change-password`,
`account-linked-accounts` (все три на обе платформы) и `account-emails`
(Android — действия строки живут в `BottomSheet.showMenu`, а он на iOS до
Maestro не доходит).

**На устройстве ещё не прогнаны** — ни симулятора, ни эмулятора не было.
`npm run e2e:lint -- --syntax` зелёный, но он не ловит тот класс ошибок, на
котором спотыкался `species-from-my-lists`.

Два решения, которые стоит помнить, читая эти флоу:

- **Пароль ни один флоу не меняет.** Он лежит в `.maestro/.env.local`, общий
  на батч; упавший на полпути флоу запер бы наружу и остаток батча, и все
  следующие прогоны. Успешная смена покрыта `test_password_api.py` и
  `ChangePasswordScreen.test.tsx`, а на устройстве проверяются форма, гейт
  «текущий пароль» и читаемость отказа сервера.
- **По ссылке из письма флоу не ходит.** Ключ живёт в mailpit, а не на
  устройстве. Разбор `<uid>-<token>` покрыт `linking.deeplinks.test.ts`.

## Что осталось за рамками

- **Ручные пункты:** открытие ссылки сброса на устройстве, привязка/отвязка
  провайдера, подтверждение второго адреса по ссылке из-под авторизации.
- **Привязка провайдера не покрыта автотестами дальше вызова API** — обмен с
  Google/Apple живой, замокать его целиком означало бы тестировать мок.

---

## Прочие пробелы (вне аккаунта, очередь)

- **Новости** — `/news/` на сайте, `/api/news/` в API, в приложении нет.
- **Форма обратной связи** — `/contact/` + `/api/contact/`, в приложении вместо
  неё `mailto` через `openSupportEmail`.
- **Статические страницы about / help / cookie-policy** — `StaticScreen` уже
  умеет рендерить любую через `/api/page2/<slug>/`, но в навигации заведены
  только `privacy` и `terms`.
- **VK и Yandex** настроены провайдерами на бэке, в приложении только
  Google/Apple. Возможно, осознанно — стоит зафиксировать решение.
