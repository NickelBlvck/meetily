// English dictionary — the source of truth for translation keys.
export const en = {
  // Sidebar
  'sidebar.searchPlaceholder': 'Search meeting content...',
  'sidebar.home': 'Home',
  'sidebar.meetings': 'Meetings',
  'sidebar.searching': 'Searching...',
  'sidebar.match': 'match',
  'sidebar.matches': 'matches',
  'sidebar.noResults': 'No results found',
  'sidebar.noMeetings': 'No meetings yet',
  'sidebar.tryDifferentSearch': 'Try a different search term',
  'sidebar.startFirstRecording': 'Start a recording to create your first note',
  'sidebar.today': 'Today',
  'sidebar.yesterday': 'Yesterday',
  'sidebar.earlier': 'Earlier',
  'sidebar.matchLabel': 'Match:',
  'sidebar.rename': 'Rename',
  'sidebar.delete': 'Delete',
  'sidebar.actionsFor': 'Actions for {title}',
  'sidebar.startRecording': 'Start Recording',
  'sidebar.stopRecording': 'Stop Recording',
  'sidebar.recordingInProgress': 'Recording in progress...',
  'sidebar.importAudio': 'Import Audio',
  'sidebar.settings': 'Settings',
  'sidebar.toggleTheme': 'Toggle Theme',
  'sidebar.meetingNotes': 'Meeting Notes',

  // Sidebar dialogs
  'sidebar.deleteConfirmText':
    'Are you sure you want to delete this meeting? This action cannot be undone.',
  'sidebar.editMeetingTitle': 'Edit Meeting Title',
  'sidebar.meetingTitle': 'Meeting Title',
  'sidebar.enterMeetingTitle': 'Enter meeting title',
  'sidebar.cancel': 'Cancel',
  'sidebar.save': 'Save',

  // Sidebar toasts
  'sidebar.toast.meetingDeleted': 'Meeting deleted successfully',
  'sidebar.toast.meetingDeletedDescription': 'All associated data has been removed',
  'sidebar.toast.deleteFailed': 'Failed to delete meeting',
  'sidebar.toast.titleEmpty': 'Meeting title cannot be empty',
  'sidebar.toast.titleUpdated': 'Meeting title updated successfully',
  'sidebar.toast.titleUpdateFailed': 'Failed to update meeting title',

  // Home page
  'home.stats.meetings': 'Meetings',
  'home.stats.transcripts': 'Transcripts',
  'home.stats.characters': 'Characters',
  'home.stats.tokens': 'Tokens',
  'home.welcome': 'Welcome to meetily!',
  'home.welcomeSubtitle': 'Start recording to see live transcription',

  // Meeting details
  'meeting.transcriptTab': 'Transcript',
  'meeting.summaryTab': 'Summary',
  'meeting.copyTranscript': 'Copy',
  'meeting.openRecordingFolder': 'Recording',
  'meeting.enhance': 'Enhance',
  'meeting.contextPlaceholder':
    'Add context for AI summary. For example people involved, meeting overview, objective etc...',
  'meeting.exportObsidianTitle':
    'Export the summary as a Markdown file into your Obsidian vault folder',
  'meeting.exportMarkdownTitle':
    'Export the summary as a standalone Markdown (.md) file',

  // Dictation
  'dictation.mic': 'Dictate',
  'dictation.listening': 'Listening...',
  'dictation.failed': 'Dictation failed',

  // Call detection
  'call.detectedTitle': 'Call detected: {app}',
  'call.detectedBody': 'Start recording in Meetily to capture this call?',
  'call.startRecording': 'Start recording',

  // Settings page
  'settings.back': 'Back',
  'settings.title': 'Settings',
  'settings.tab.general': 'General',
  'settings.tab.recordings': 'Recordings',
  'settings.tab.transcription': 'Transcription',
  'settings.tab.summary': 'Summary',
  'settings.tab.prompts': 'Prompts',
  'settings.tab.templates': 'Templates',
  'settings.tab.beta': 'Beta',
  'settings.language': 'Language',
  'settings.languageDescription': 'Interface language of the application',
  'settings.general.notifications': 'Notifications',
  'settings.general.notificationsDescription':
    'Enable or disable notifications of start and end of meeting',
  'settings.general.storage': 'Data Storage Locations',
  'settings.general.storageDescription': 'View and access where Meetily stores your data',
  'settings.general.recordingsFolder': 'Meeting Recordings',
  'settings.general.openFolder': 'Open Folder',
  'settings.general.note':
    'Database and models are stored together in your application data directory for unified management.',
  'settings.general.loading': 'Loading Preferences...',
} as const;

export type TranslationKey = keyof typeof en;
