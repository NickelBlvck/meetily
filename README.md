# Meetily (Fork by NickelBlvck)

Локальный AI-ассистент для встреч: живая расшифровка речи и саммари **без облака** —
всё работает на вашем компьютере или на выбранном вами API.

Это форк [Meetily от Zackriya Solutions](https://github.com/Zackriya-Solutions/meetily),
доработанный под себя. Спасибо оригинальным авторам за отличный продукт —
весь базовый движок (Tauri + Next.js + Whisper/Parakeet + Ollama/OpenAI-совместимые API) унаследован оттуда.

> Оригинальный README сохранён в [README-upstream.md](README-upstream.md).

---

## Что добавлено/изменено в форке

### Интерфейс
- **Русский интерфейс по умолчанию** и переключатель языка English/Русский в Settings → General
  (языки расшифровки/саммари настраиваются отдельно, как и в оригинале).
- Редизайн сайдбара: группировка встреч Today / Yesterday / Earlier, компактные строки
  с датой `18.09` и меню ⋮ (переименовать/удалить) без «дёргания» при наведении.
- Карточка статистики на главной: количество встреч, фрагментов транскриптов, символов и
  потраченных токенов (для API-транскрибации).
- Тёмная тема доведена до ума — убраны белёсые элементы на странице встречи.
- Логотип и подпись «Fork by NickelBlvck», окно About помечает форк.

### Функциональность
- **Диктовка в «Контекст встречи»** — иконка микрофона в textarea: запись с микрофона →
  WAV → транскрибация выбранным движком → вставка текста по курсору. Esc/повторный клик — стоп.
- **Обнаружение звонков** — если запущен Zoom, открыт Google Meet в браузере, идёт звонок в
  Teams/Skype/Webex, Meetily предложит: *«Обнаружен звонок — начать запись?»*
  (тост с кнопкой + системное уведомление, если окно в фоне).
- **Редактирование шаблонов саммари** — вкладка Templates в настройках: редактирование JSON,
  дублирование, создание своих шаблонов, сброс к встроенным.
- **Учёт токенов (аналог /usage)** — при транскрибации через OpenAI-совместимый API токены
  парсятся из ответа, суммируются и отображаются в карточке статистики.
- Кнопка записи — тумблер Start/Stop в сайдбаре; плавающая панель записи с главной убрана.
- Кнопки Enhance/Stop на странице встречи перерисованы в токенах темы.

---

## Сборка

Требования: **Node.js 18+**, **pnpm**, **Rust** (stable), на Windows — **MSVC Build Tools**.

```bash
git clone https://github.com/NickelBlvck/meetily.git
cd meetily/frontend
pnpm install

# разработка (Vite/Next + Tauri)
pnpm tauri dev

# релизная сборка установщиков (NSIS + MSI)
pnpm tauri build
```

Готовые установщики после сборки:
```
target/release/bundle/nsis/meetily_<version>_x64-setup.exe
target/release/bundle/msi/meetily_<version>_x64_en-US.msi
```

### Windows: LIBCLANG_PATH

На Windows `whisper-rs 0.13.2` (bindgen 0.69) несовместим с системным LLVM 23.
Если `cargo` падает на bindgen, укажите clang из pip-пакета:

```powershell
$env:LIBCLANG_PATH = "C:\Users\<user>\AppData\Local\Programs\Python\Python311\Lib\site-packages\clang\native"
```

### Модели расшифровки
- **Parakeet** (по умолчанию) и **Whisper** — локальные, скачиваются из настроек приложения.
- **Custom (OpenAI-совместимый endpoint)** — например self-hosted whisper.cpp server или
  любой `/v1/audio/transcriptions`.

---

## Разработка

```
frontend/           # Next.js UI
frontend/src-tauri/ # Rust backend (Tauri 2)
```

Проверки перед PR:
```bash
cd frontend
npx tsc --noEmit && npx next build

cd src-tauri
cargo check   # на Windows — с LIBCLANG_PATH из раздела выше
```

---

## Credits & License

Основано на [Meetily](https://github.com/Zackriya-Solutions/meetily) от
[Zackriya Solutions](https://www.zackriya.com/) — см. оригинальный репозиторий,
[сайт](https://meetily.ai) и Discord.

Лицензия — **MIT** (наследуется от оригинального проекта).
