import type { TranslationKey } from './en';

// Russian dictionary — typed against the English one so keys can never drift.
export const ru: Record<TranslationKey, string> = {
  // Sidebar
  'sidebar.searchPlaceholder': 'Поиск по содержимому встреч...',
  'sidebar.home': 'Главная',
  'sidebar.meetings': 'Встречи',
  'sidebar.searching': 'Поиск...',
  'sidebar.match': 'совпадение',
  'sidebar.matches': 'совпадений',
  'sidebar.noResults': 'Ничего не найдено',
  'sidebar.noMeetings': 'Пока нет встреч',
  'sidebar.tryDifferentSearch': 'Попробуйте изменить запрос',
  'sidebar.startFirstRecording': 'Начните запись, чтобы создать первую заметку',
  'sidebar.today': 'Сегодня',
  'sidebar.yesterday': 'Вчера',
  'sidebar.earlier': 'Ранее',
  'sidebar.matchLabel': 'Совпадение:',
  'sidebar.rename': 'Переименовать',
  'sidebar.delete': 'Удалить',
  'sidebar.actionsFor': 'Действия для {title}',
  'sidebar.startRecording': 'Начать запись',
  'sidebar.stopRecording': 'Остановить запись',
  'sidebar.recordingInProgress': 'Идёт запись...',
  'sidebar.importAudio': 'Импорт аудио',
  'sidebar.settings': 'Настройки',
  'sidebar.toggleTheme': 'Переключить тему',
  'sidebar.meetingNotes': 'Заметки встреч',

  // Sidebar dialogs
  'sidebar.deleteConfirmText':
    'Вы уверены, что хотите удалить эту встречу? Это действие нельзя отменить.',
  'sidebar.editMeetingTitle': 'Переименовать встречу',
  'sidebar.meetingTitle': 'Название встречи',
  'sidebar.enterMeetingTitle': 'Введите название встречи',
  'sidebar.cancel': 'Отмена',
  'sidebar.save': 'Сохранить',

  // Sidebar toasts
  'sidebar.toast.meetingDeleted': 'Встреча удалена',
  'sidebar.toast.meetingDeletedDescription': 'Все связанные данные удалены',
  'sidebar.toast.deleteFailed': 'Не удалось удалить встречу',
  'sidebar.toast.titleEmpty': 'Название встречи не может быть пустым',
  'sidebar.toast.titleUpdated': 'Название встречи обновлено',
  'sidebar.toast.titleUpdateFailed': 'Не удалось обновить название встречи',

  // Home page
  'home.stats.meetings': 'Встреч',
  'home.stats.transcripts': 'Фрагментов',
  'home.stats.characters': 'Символов',
  'home.stats.tokens': 'Токенов',
  'home.welcome': 'Добро пожаловать в meetily!',
  'home.welcomeSubtitle': 'Начните запись, чтобы видеть живую расшифровку',

  // Meeting details
  'meeting.transcriptTab': 'Транскрипт',
  'meeting.summaryTab': 'Саммари',
  'meeting.copyTranscript': 'Копировать',
  'meeting.openRecordingFolder': 'Запись',
  'meeting.enhance': 'Улучшить',
  'meeting.contextPlaceholder':
    'Добавьте контекст для ИИ-саммари: участники, тема и цель встречи и т.п...',
  'meeting.exportObsidianTitle':
    'Экспортировать саммари в Markdown-файл в папку хранилища Obsidian',
  'meeting.exportMarkdownTitle':
    'Экспортировать саммари в отдельный Markdown-файл (.md)',

  // Dictation
  'dictation.mic': 'Продиктовать',
  'dictation.listening': 'Слушаю...',
  'dictation.failed': 'Не удалось распознать речь',

  // Call detection
  'call.detectedTitle': 'Обнаружен звонок: {app}',
  'call.detectedBody': 'Начать запись в Meetily, чтобы сохранить этот звонок?',
  'call.startRecording': 'Начать запись',

  // Settings page
  'settings.back': 'Назад',
  'settings.title': 'Настройки',
  'settings.tab.general': 'Общие',
  'settings.tab.recordings': 'Записи',
  'settings.tab.transcription': 'Расшифровка',
  'settings.tab.summary': 'Саммари',
  'settings.tab.prompts': 'Промпты',
  'settings.tab.templates': 'Шаблоны',
  'settings.tab.beta': 'Beta',
  'settings.language': 'Язык',
  'settings.languageDescription': 'Язык интерфейса приложения',
  'settings.general.notifications': 'Уведомления',
  'settings.general.notificationsDescription':
    'Включить или отключить уведомления о начале и конце встречи',
  'settings.general.storage': 'Расположение данных',
  'settings.general.storageDescription': 'Просмотр и доступ к данным Meetily',
  'settings.general.recordingsFolder': 'Записи встреч',
  'settings.general.openFolder': 'Открыть папку',
  'settings.general.note':
    'База данных и модели хранятся вместе в каталоге данных приложения для удобного управления.',
  'settings.general.loading': 'Загрузка настроек...',
};
