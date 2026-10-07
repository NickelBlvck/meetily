'use client';

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { appDataDir } from '@tauri-apps/api/path';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { useRecordingState, RecordingStatus } from '@/contexts/RecordingStateContext';
import { useConfig } from '@/contexts/ConfigContext';
import { StatusOverlays } from '@/app/_components/StatusOverlays';
import Analytics from '@/lib/analytics';
import { SettingsModals } from './_components/SettingsModal';
import { TranscriptPanel } from './_components/TranscriptPanel';
import { useModalState } from '@/hooks/useModalState';
import { useRecordingStateSync } from '@/hooks/useRecordingStateSync';
import { useRecordingStart } from '@/hooks/useRecordingStart';
import { useRecordingStop } from '@/hooks/useRecordingStop';
import { useTranscriptRecovery } from '@/hooks/useTranscriptRecovery';
import { TranscriptRecovery } from '@/components/TranscriptRecovery';
import { indexedDBService } from '@/services/indexedDBService';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface AppStats {
  meetingsCount: number;
  transcriptsCount: number;
  transcriptsChars: number;
  transcriptionTokens: number;
}

export default function Home() {
  // Local page state (not moved to contexts)
  const [isRecording, setIsRecordingState] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [stats, setStats] = useState<AppStats | null>(null);

  // Use contexts for state management
  const { transcriptModelConfig, t } = useConfig();
  const recordingState = useRecordingState();

  // Extract status from global state
  const { status, isStopping, isProcessing, isSaving } = recordingState;

  // Hooks
  const { setIsMeetingActive, isCollapsed: sidebarCollapsed, refetchMeetings } = useSidebar();
  const { modals, messages, showModal, hideModal } = useModalState(transcriptModelConfig);
  const { setIsRecordingDisabled } = useRecordingStateSync(isRecording, setIsRecordingState, setIsMeetingActive);
  useRecordingStart(isRecording, setIsRecordingState, showModal);

  // Get handleRecordingStop function and setIsStopping (state comes from global context)
  const { handleRecordingStop, setIsStopping } = useRecordingStop(
    setIsRecordingState,
    setIsRecordingDisabled
  );

  // Stop the backend recording and process the result.
  // Invoked from the sidebar Stop button via the 'stop-recording-from-sidebar'
  // window event (the old RecordingControls pill lived here before).
  const handleStopFromSidebar = useCallback(async () => {
    if (!recordingState.isRecording) return;
    setIsStopping(true);
    try {
      const dataDir = await appDataDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const savePath = `${dataDir}/recording-${timestamp}.wav`;
      await invoke('stop_recording', { args: { save_path: savePath } });
      Analytics.trackTranscriptionSuccess();
      await handleRecordingStop(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('No recording in progress')) {
        console.error('Failed to stop recording:', error);
      }
      await handleRecordingStop(false);
    } finally {
      setIsStopping(false);
    }
  }, [recordingState.isRecording, handleRecordingStop, setIsStopping]);

  useEffect(() => {
    const handler = () => { void handleStopFromSidebar(); };
    window.addEventListener('stop-recording-from-sidebar', handler);
    return () => window.removeEventListener('stop-recording-from-sidebar', handler);
  }, [handleStopFromSidebar]);

  // Load usage statistics for the dashboard card (refreshed on token usage events)
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      invoke<AppStats>('api_get_stats')
        .then((result) => {
          if (!cancelled) setStats(result);
        })
        .catch((error) => {
          console.error('Failed to load stats:', error);
        });
    };
    refresh();

    let unlisten: (() => void) | undefined;
    listen('transcription-usage-updated', refresh)
      .then((fn) => { unlisten = fn; })
      .catch(() => {});

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // Recovery hook
  const {
    recoverableMeetings,
    isLoading: isLoadingRecovery,
    isRecovering,
    checkForRecoverableTranscripts,
    recoverMeeting,
    loadMeetingTranscripts,
    deleteRecoverableMeeting
  } = useTranscriptRecovery();

  const router = useRouter();

  useEffect(() => {
    // Track page view
    Analytics.trackPageView('home');
  }, []);

  // Startup recovery check
  useEffect(() => {
    const performStartupChecks = async () => {
      try {
        // Skip recovery check if currently recording or processing stop
        // This prevents the recovery dialog from showing when:
        if (recordingState.isRecording ||
          status === RecordingStatus.STOPPING ||
          status === RecordingStatus.PROCESSING_TRANSCRIPTS ||
          status === RecordingStatus.SAVING) {
          console.log('Skipping recovery check - recording in progress or processing');
          return;
        }

        // 1. Clean up old meetings (7+ days)
        try {
          await indexedDBService.deleteOldMeetings(7);
        } catch (error) {
          console.warn('⚠️ Failed to clean up old meetings:', error);
        }

        // 2. Clean up saved meetings (24+ hours after save)
        try {
          await indexedDBService.deleteSavedMeetings(24);
        } catch (error) {
          console.warn('⚠️ Failed to clean up saved meetings:', error);
        }

        // 3. Always check for recoverable meetings on startup
        // Don't skip based on sessionStorage - we need to check every time
        await checkForRecoverableTranscripts();
      } catch (error) {
        console.error('Failed to perform startup checks:', error);
      }
    };

    performStartupChecks();
  }, [checkForRecoverableTranscripts, recordingState.isRecording, status]);

  // Watch for recoverable meetings changes and show dialog once per session
  useEffect(() => {
    // Only show dialog if we have meetings and haven't shown it yet this session
    if (recoverableMeetings.length > 0) {
      const shownThisSession = sessionStorage.getItem('recovery_dialog_shown');
      if (!shownThisSession) {
        setShowRecoveryDialog(true);
        sessionStorage.setItem('recovery_dialog_shown', 'true');
      }
    }
  }, [recoverableMeetings]);

  // Handle recovery with toast notifications and navigation
  const handleRecovery = async (meetingId: string) => {
    try {
      const result = await recoverMeeting(meetingId);

      if (result.success) {
        toast.success('Meeting recovered successfully!', {
          description: result.audioRecoveryStatus?.status === 'success'
            ? 'Transcripts and audio recovered'
            : 'Transcripts recovered (no audio available)',
          action: result.meetingId ? {
            label: 'View Meeting',
            onClick: () => {
              router.push(`/meeting-details?id=${result.meetingId}`);
            }
          } : undefined,
          duration: 10000,
        });

        // Refresh sidebar to show the newly recovered meeting
        await refetchMeetings();

        // If no more recoverable meetings, clear session flag so dialog can show again
        if (recoverableMeetings.length === 0) {
          sessionStorage.removeItem('recovery_dialog_shown');
        }

        // Auto-navigate after a short delay
        if (result.meetingId) {
          setTimeout(() => {
            router.push(`/meeting-details?id=${result.meetingId}`);
          }, 2000);
        }
      }
    } catch (error) {
      toast.error('Failed to recover meeting', {
        description: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  };

  // Handle dialog close - clear session flag if no meetings left
  const handleDialogClose = () => {
    setShowRecoveryDialog(false);
    // If user closes dialog and there are no more meetings, clear the flag
    // This allows the dialog to show again next session if new meetings appear
    if (recoverableMeetings.length === 0) {
      sessionStorage.removeItem('recovery_dialog_shown');
    }
  };

  // Computed values using global status
  const isProcessingStop = status === RecordingStatus.PROCESSING_TRANSCRIPTS || isProcessing;

  const statItems = stats ? [
    { label: t('home.stats.meetings'), value: stats.meetingsCount },
    { label: t('home.stats.transcripts'), value: stats.transcriptsCount },
    { label: t('home.stats.characters'), value: stats.transcriptsChars },
    // Token usage is only meaningful for remote (API) transcription
    ...(stats.transcriptionTokens > 0
      ? [{ label: t('home.stats.tokens'), value: stats.transcriptionTokens }]
      : []),
  ] : [];

  return (
    <div className="flex flex-col h-screen bg-muted/50">
      {/* All Modals supported*/}
      <SettingsModals
        modals={modals}
        messages={messages}
        onClose={hideModal}
      />

      {/* Recovery Dialog */}
      <TranscriptRecovery
        isOpen={showRecoveryDialog}
        onClose={handleDialogClose}
        recoverableMeetings={recoverableMeetings}
        onRecover={handleRecovery}
        onDelete={deleteRecoverableMeeting}
        onLoadPreview={loadMeetingTranscripts}
      />
      <div className="flex flex-1 overflow-hidden">
        <TranscriptPanel
          isProcessingStop={isProcessingStop}
          isStopping={isStopping}
          showModal={showModal}
        />

        {/* Usage statistics card - replaces the old recording pill (recording lives in the sidebar now) */}
        {!isRecording && stats && (
          <div className="fixed bottom-12 left-0 right-0 z-10 pointer-events-none">
            <div
              className="flex justify-center pl-8 transition-[margin] duration-300"
              style={{
                marginLeft: sidebarCollapsed ? '4rem' : '16rem'
              }}
            >
              <div className="bg-card/90 backdrop-blur border border-border rounded-2xl shadow-lg px-6 py-3 flex items-center gap-8">
                {statItems.map((item) => (
                  <div key={item.label} className="flex flex-col items-center">
                    <span className="text-lg font-semibold tabular-nums text-foreground">
                      {item.value.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Status Overlays - Processing and Saving */}
        <StatusOverlays
          isProcessing={status === RecordingStatus.PROCESSING_TRANSCRIPTS && !recordingState.isRecording}
          isSaving={status === RecordingStatus.SAVING}
          sidebarCollapsed={sidebarCollapsed}
        />
      </div>
    </div>
  );
}
