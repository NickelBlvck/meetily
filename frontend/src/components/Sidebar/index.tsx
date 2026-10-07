'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeftCircle,
  ChevronRightCircle,
  Home,
  Mic,
  Square,
  Upload,
  Settings,
  MoreVertical,
  Pencil,
  Trash2,
  SearchIcon,
  SearchX,
  X,
  NotebookPen,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useSidebar } from './SidebarProvider';
import type { CurrentMeeting } from '@/components/Sidebar/SidebarProvider';
import { ConfirmationModal } from '../ConfirmationModel/confirmation-modal';
import { ThemeToggle } from '@/components/ThemeToggle';
import Analytics from '@/lib/analytics';
import { invoke } from '@tauri-apps/api/core';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { useConfig } from '@/contexts/ConfigContext';
import type { TranslationKey } from '@/lib/i18n';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import Logo from '../Logo';
import Info from '../Info';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '../ui/input-group';

interface SidebarItem {
  id: string;
  title: string;
  type: 'folder' | 'file';
  createdAt?: string;
  children?: SidebarItem[];
}

type DateGroup = 'today' | 'yesterday' | 'earlier';

const GROUP_LABEL_KEYS: Record<DateGroup, TranslationKey> = {
  today: 'sidebar.today',
  yesterday: 'sidebar.yesterday',
  earlier: 'sidebar.earlier',
};

function getDateGroup(iso?: string): DateGroup {
  if (!iso) return 'earlier';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return 'earlier';
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  return 'earlier';
}

function formatRowTime(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const group = getDateGroup(iso);
  if (group === 'earlier') {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const iconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

const Sidebar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentMeeting,
    setCurrentMeeting,
    sidebarItems,
    isCollapsed,
    toggleCollapse,
    handleRecordingToggle,
    searchTranscripts,
    searchResults,
    isSearching,
    meetings,
    setMeetings,
  } = useSidebar();

  // Get recording state from RecordingStateContext (single source of truth)
  const { isRecording } = useRecordingState();
  const { openImportDialog } = useImportDialog();
  const { betaFeatures, t } = useConfig();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['meetings']));
  const [searchQuery, setSearchQuery] = useState('');

  // State for edit modal
  const [editModalState, setEditModalState] = useState<{ isOpen: boolean; meetingId: string | null; currentTitle: string }>({
    isOpen: false,
    meetingId: null,
    currentTitle: ''
  });
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; itemId: string | null }>({ isOpen: false, itemId: null });

  // Keep the meetings folder always expanded
  useEffect(() => {
    if (!expandedFolders.has('meetings')) {
      const newExpanded = new Set(expandedFolders);
      newExpanded.add('meetings');
      setExpandedFolders(newExpanded);
    }
  }, [expandedFolders]);

  // Handle search input changes
  const handleSearchChange = useCallback(async (value: string) => {
    setSearchQuery(value);
    await searchTranscripts(value);
  }, [searchTranscripts]);

  // Transcript search results keyed by meeting id for snippet display
  const transcriptMatches = useMemo(
    () => new Map(searchResults.map((result: any) => [result.id, result])),
    [searchResults]
  );

  const meetingsFolder = useMemo(
    () => sidebarItems.find(item => item.type === 'folder'),
    [sidebarItems]
  );

  const visibleMeetings = useMemo(() => {
    const children = meetingsFolder?.children ?? [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return children;
    return children.filter(
      item => item.title.toLowerCase().includes(query) || transcriptMatches.has(item.id)
    );
  }, [meetingsFolder, searchQuery, transcriptMatches]);

  // Group meetings by date: Today / Yesterday / Earlier
  const groupedMeetings = useMemo(() => {
    const groups: { group: DateGroup; items: SidebarItem[] }[] = [
      { group: 'today', items: [] },
      { group: 'yesterday', items: [] },
      { group: 'earlier', items: [] },
    ];
    visibleMeetings.forEach(item => {
      const bucket = groups.find(g => g.group === getDateGroup(item.createdAt));
      bucket?.items.push(item);
    });
    return groups.filter(g => g.items.length > 0);
  }, [visibleMeetings]);

  const handleDelete = async (itemId: string) => {
    try {
      await invoke('api_delete_meeting', { meetingId: itemId });
      setMeetings(meetings.filter((m: CurrentMeeting) => m.id !== itemId));

      // Track meeting deletion
      Analytics.trackMeetingDeleted(itemId);

      toast.success(t('sidebar.toast.meetingDeleted'), {
        description: t('sidebar.toast.meetingDeletedDescription')
      });

      // If deleting the active meeting, navigate to home
      if (currentMeeting?.id === itemId) {
        setCurrentMeeting({ id: 'intro-call', title: '+ New Call' });
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      toast.error(t('sidebar.toast.deleteFailed'), {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteModalState.itemId) {
      handleDelete(deleteModalState.itemId);
    }
    setDeleteModalState({ isOpen: false, itemId: null });
  };

  // Handle modal editing of meeting names
  const handleEditStart = (meetingId: string, currentTitle: string) => {
    setEditModalState({ isOpen: true, meetingId, currentTitle });
    setEditingTitle(currentTitle);
  };

  const handleEditConfirm = async () => {
    const newTitle = editingTitle.trim();
    const meetingId = editModalState.meetingId;
    if (!meetingId) return;

    if (!newTitle) {
      toast.error(t('sidebar.toast.titleEmpty'));
      return;
    }

    try {
      await invoke('api_save_meeting_title', {
        meetingId: meetingId,
        title: newTitle,
      });

      setMeetings(meetings.map((m: CurrentMeeting) =>
        m.id === meetingId ? { ...m, title: newTitle } : m
      ));

      if (currentMeeting?.id === meetingId) {
        setCurrentMeeting({ id: meetingId, title: newTitle });
      }

      Analytics.trackButtonClick('edit_meeting_title', 'sidebar');
      toast.success(t('sidebar.toast.titleUpdated'));

      setEditModalState({ isOpen: false, meetingId: null, currentTitle: '' });
      setEditingTitle('');
    } catch (error) {
      console.error('Failed to update meeting title:', error);
      toast.error(t('sidebar.toast.titleUpdateFailed'), {
        description: error instanceof Error ? error.message : String(error)
      });
    }
  };

  const handleEditCancel = () => {
    setEditModalState({ isOpen: false, meetingId: null, currentTitle: '' });
    setEditingTitle('');
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const openMeeting = (item: SidebarItem) => {
    setCurrentMeeting({ id: item.id, title: item.title });
    const basePath = item.id.startsWith('intro-call') ? '/' :
      item.id.includes('-') ? `/meeting-details?id=${item.id}` : `/notes/${item.id}`;
    router.push(basePath);
  };

  const renderCollapsedIcons = () => {
    const isHomePage = pathname === '/';
    const isMeetingPage = pathname?.includes('/meeting-details');
    const isSettingsPage = pathname === '/settings';

    return (
      <TooltipProvider>
        <div className="flex flex-col items-center space-y-4 mt-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push('/')}
                className={`p-2 rounded-lg transition-colors duration-150 ${isHomePage ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Home className="w-5 h-5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t('sidebar.home')}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleRecordingToggle}
                className={`p-2 ${isRecording ? 'bg-destructive/70 cursor-pointer' : 'bg-destructive hover:bg-destructive/90'} rounded-full transition-colors duration-150 shadow-sm`}
              >
                {isRecording ? (
                  <Square className="w-5 h-5 text-white" />
                ) : (
                  <Mic className="w-5 h-5 text-white" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{isRecording ? t('sidebar.stopRecording') : t('sidebar.startRecording')}</p>
            </TooltipContent>
          </Tooltip>

          {betaFeatures.importAndRetranscribe && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => openImportDialog()}
                  className="p-2 rounded-lg transition-colors duration-150 hover:bg-primary/20 bg-primary/10"
                >
                  <Upload className="w-5 h-5 text-primary" />
                </button>
              </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t('sidebar.importAudio')}</p>
            </TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (isCollapsed) toggleCollapse();
                }}
                className={`p-2 rounded-lg transition-colors duration-150 ${isMeetingPage ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <NotebookPen className="w-5 h-5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t('sidebar.meetingNotes')}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push('/settings')}
                className={`p-2 rounded-lg transition-colors duration-150 ${isSettingsPage ? 'bg-muted' : 'hover:bg-muted'}`}
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t('sidebar.settings')}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <ThemeToggle className="p-2" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t('sidebar.toggleTheme')}</p>
            </TooltipContent>
          </Tooltip>

          <Info isCollapsed={isCollapsed} />
        </div>
      </TooltipProvider>
    );
  };

  const renderMeetingRow = (item: SidebarItem) => {
    const isActive = currentMeeting?.id === item.id;
    const match = transcriptMatches.get(item.id);

    return (
      <div key={item.id} className="group/row mx-1">
        <div
          onClick={() => openMeeting(item)}
          className={`relative flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
            isActive
              ? 'bg-primary/10 text-foreground'
              : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
          }`}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
          )}
          <span
            className={`w-1.5 h-1.5 shrink-0 rounded-full ${
              isActive ? 'bg-primary' : 'border border-muted-foreground/40'
            }`}
          />
          <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
          <span className="relative flex h-5 w-9 shrink-0 items-center justify-end">
            <span className="text-xs tabular-nums text-muted-foreground transition-opacity group-hover/row:opacity-0">
              {formatRowTime(item.createdAt)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={e => e.stopPropagation()}
                  className="absolute right-0 hidden h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none group-hover/row:flex"
                  aria-label={t('sidebar.actionsFor', { title: item.title })}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => handleEditStart(item.id, item.title)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('sidebar.rename')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteModalState({ isOpen: true, itemId: item.id })}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('sidebar.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        </div>

        {/* Show transcript match snippet if available */}
        {match && (
          <div className="mx-3 mb-1 mt-0.5 line-clamp-2 rounded border border-border bg-muted/50 p-1.5 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t('sidebar.matchLabel')}</span> {match.matchContext}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed top-0 left-0 h-screen z-40">
      {/* Floating collapse button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-6 top-20 z-50 p-1 bg-card hover:bg-muted rounded-full shadow-lg border"
        style={{ transform: 'translateX(50%)' }}
      >
        {isCollapsed ? (
          <ChevronRightCircle className="w-6 h-6" />
        ) : (
          <ChevronLeftCircle className="w-6 h-6" />
        )}
      </button>

      <div
        className={`h-screen bg-card border-r shadow-sm flex flex-col transition-all duration-300 ${
          isCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Header with logo + search */}
        <div className="flex-shrink-0 p-3">
          <Logo isCollapsed={isCollapsed} />
          {!isCollapsed && (
            <div className="mt-2">
              <InputGroup>
                <InputGroupInput
                  placeholder={t('sidebar.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                />
                <InputGroupAddon>
                  <SearchIcon />
                </InputGroupAddon>
                {searchQuery && (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton onClick={() => handleSearchChange('')}>
                      <X />
                    </InputGroupButton>
                  </InputGroupAddon>
                )}
              </InputGroup>
            </div>
          )}
        </div>

        {/* Main content */}
        {isCollapsed ? (
          <div className="flex-1 flex flex-col min-h-0">
            {renderCollapsedIcons()}
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Home navigation */}
            <div className="flex-shrink-0 px-2 pt-1">
              <div
                onClick={() => router.push('/')}
                className={`mx-1 flex h-9 cursor-pointer items-center rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                  pathname === '/'
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                }`}
              >
                <Home className="mr-2.5 h-4 w-4 text-muted-foreground" />
                <span>{t('sidebar.home')}</span>
              </div>
            </div>

            {/* Meetings section header */}
            <div className="flex-shrink-0 px-2 pt-3">
              <div
                onClick={() => toggleFolder('meetings')}
                className="mx-1 flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
              >
                <NotebookPen className="mr-2 h-3.5 w-3.5" />
                <span>{t('sidebar.meetings')}</span>
                <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums">
                  {meetings.length}
                </span>
                <span className="ml-auto flex items-center gap-1.5">
                  {searchQuery && isSearching && (
                    <span className="text-[11px] normal-case font-normal text-primary animate-pulse">
                      {t('sidebar.searching')}
                    </span>
                  )}
                  {searchQuery && !isSearching && searchResults.length > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] normal-case font-medium text-primary">
                      {searchResults.length}{' '}
                      {searchResults.length === 1 ? t('sidebar.match') : t('sidebar.matches')}
                    </span>
                  )}
                  {expandedFolders.has('meetings') ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
              </div>
            </div>

            {/* Grouped meeting list */}
            {!isCollapsed && expandedFolders.has('meetings') && (
              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pb-2">
                {groupedMeetings.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <SearchX className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-foreground/70">
                      {searchQuery ? t('sidebar.noResults') : t('sidebar.noMeetings')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {searchQuery
                        ? t('sidebar.tryDifferentSearch')
                        : t('sidebar.startFirstRecording')}
                    </p>
                  </div>
                ) : (
                  groupedMeetings.map(({ group, items }) => (
                    <div key={group} className="mt-2">
                      <div className="px-4 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                        {t(GROUP_LABEL_KEYS[group])}
                      </div>
                      <div className="px-1">
                        {items.map(renderMeetingRow)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!isCollapsed && (
          <div className="flex-shrink-0 border-t border-border p-3">
            <button
              onClick={handleRecordingToggle}
              className={`w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors shadow-sm ${
                isRecording
                  ? 'bg-destructive/70 text-destructive-foreground hover:bg-destructive/80'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              }`}
            >
              {isRecording ? (
                <>
                  <Square className="h-4 w-4" />
                  <span>{t('sidebar.stopRecording')}</span>
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  <span>{t('sidebar.startRecording')}</span>
                </>
              )}
            </button>

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                {betaFeatures.importAndRetranscribe && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => openImportDialog()} className={iconButtonClass}>
                          <Upload className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>{t('sidebar.importAudio')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => router.push('/settings')}
                        className={iconButtonClass}
                      >
                        <Settings className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>{t('sidebar.settings')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <ThemeToggle className="h-9 w-9" />
                <Info variant="icon" />
              </div>
              <span className="pr-1 text-xs text-muted-foreground">v0.4.1</span>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Delete */}
      <ConfirmationModal
        isOpen={deleteModalState.isOpen}
        text={t('sidebar.deleteConfirmText')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalState({ isOpen: false, itemId: null })}
      />

      {/* Edit Meeting Title Modal */}
      <Dialog open={editModalState.isOpen} onOpenChange={(open) => {
        if (!open) handleEditCancel();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <VisuallyHidden>
            <DialogTitle>{t('sidebar.editMeetingTitle')}</DialogTitle>
          </VisuallyHidden>
          <div className="py-4">
            <h3 className="text-lg font-semibold mb-4">{t('sidebar.editMeetingTitle')}</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="meeting-title" className="block text-sm font-medium text-foreground/80 mb-2">
                  {t('sidebar.meetingTitle')}
                </label>
                <input
                  id="meeting-title"
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditConfirm();
                    } else if (e.key === 'Escape') {
                      handleEditCancel();
                    }
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder={t('sidebar.enterMeetingTitle')}
                  autoFocus
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={handleEditCancel}
              className="px-4 py-2 text-sm font-medium text-foreground/80 bg-muted hover:bg-accent rounded-md transition-colors"
            >
              {t('sidebar.cancel')}
            </button>
            <button
              onClick={handleEditConfirm}
              className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
            >
              {t('sidebar.save')}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sidebar;
