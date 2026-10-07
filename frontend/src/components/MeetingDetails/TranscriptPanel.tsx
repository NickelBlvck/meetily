"use client";

import { Transcript, TranscriptSegmentData } from '@/types';
import { TranscriptView } from '@/components/TranscriptView';
import { VirtualizedTranscriptView } from '@/components/VirtualizedTranscriptView';
import { TranscriptButtonGroup } from './TranscriptButtonGroup';
import { useMemo, useRef, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useDictation } from '@/hooks/useDictation';

interface TranscriptPanelProps {
  transcripts: Transcript[];
  customPrompt: string;
  onPromptChange: (value: string) => void;
  onCopyTranscript: () => void;
  onOpenMeetingFolder: () => Promise<void>;
  isRecording: boolean;
  disableAutoScroll?: boolean;

  // Optional pagination props (when using virtualization)
  usePagination?: boolean;
  segments?: TranscriptSegmentData[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  totalCount?: number;
  loadedCount?: number;
  onLoadMore?: () => void;

  // Retranscription props
  meetingId?: string;
  meetingFolderPath?: string | null;
  onRefetchTranscripts?: () => Promise<void>;
}

export function TranscriptPanel({
  transcripts,
  customPrompt,
  onPromptChange,
  onCopyTranscript,
  onOpenMeetingFolder,
  isRecording,
  disableAutoScroll = false,
  usePagination = false,
  segments,
  hasMore,
  isLoadingMore,
  totalCount,
  loadedCount,
  onLoadMore,
  meetingId,
  meetingFolderPath,
  onRefetchTranscripts,
}: TranscriptPanelProps) {
  const { t } = useConfig();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Insert recognized dictation text at the caret, padded with spaces
  const handleDictationInsert = useCallback((text: string) => {
    const textarea = textareaRef.current;
    const value = customPrompt;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    const needsSpace = start > 0 && !/\s$/.test(value.slice(0, start));
    const inserted = (needsSpace ? ' ' : '') + text + ' ';
    onPromptChange(value.slice(0, start) + inserted + value.slice(end));
    const caret = start + inserted.length;
    requestAnimationFrame(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(caret, caret);
      }
    });
  }, [customPrompt, onPromptChange]);

  const { state: dictationState, toggle: toggleDictation } = useDictation({
    onInsert: handleDictationInsert,
    disabled: isRecording,
  });
  // Convert transcripts to segments if pagination is not used but we want virtualization
  const convertedSegments = useMemo(() => {
    if (usePagination && segments) {
      return segments;
    }
    // Convert transcripts to segments for virtualization
    return transcripts.map(t => ({
      id: t.id,
      timestamp: t.audio_start_time ?? 0,
      endTime: t.audio_end_time,
      text: t.text,
      confidence: t.confidence,
    }));
  }, [transcripts, usePagination, segments]);

  return (
    <div className="flex h-full min-w-0 w-full bg-card flex-col relative @container">
      {/* Title area */}
      <div className="p-4 border-b border-border">
        <TranscriptButtonGroup
          transcriptCount={usePagination ? (totalCount ?? convertedSegments.length) : (transcripts?.length || 0)}
          onCopyTranscript={onCopyTranscript}
          onOpenMeetingFolder={onOpenMeetingFolder}
          meetingId={meetingId}
          meetingFolderPath={meetingFolderPath}
          onRefetchTranscripts={onRefetchTranscripts}
        />
      </div>

      {/* Transcript content - use virtualized view for better performance */}
      <div className="flex-1 overflow-hidden pb-4">
        <VirtualizedTranscriptView
          segments={convertedSegments}
          isRecording={isRecording}
          isPaused={false}
          isProcessing={false}
          isStopping={false}
          enableStreaming={false}
          showConfidence={true}
          disableAutoScroll={disableAutoScroll}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          totalCount={totalCount}
          loadedCount={loadedCount}
          onLoadMore={onLoadMore}
        />
      </div>

      {/* Custom prompt input at bottom of transcript section */}
      {!isRecording && convertedSegments.length > 0 && (
        <div className="p-1 border-t border-border">
          <div className="relative">
            <textarea
              ref={textareaRef}
              placeholder={t('meeting.contextPlaceholder')}
              className="w-full px-3 py-2 pr-10 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring bg-card shadow-sm min-h-[80px] resize-y"
              value={customPrompt}
              onChange={(e) => onPromptChange(e.target.value)}
            />
            <button
              type="button"
              onClick={toggleDictation}
              disabled={isRecording}
              aria-label={t('dictation.mic')}
              title={t('dictation.mic')}
              className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                dictationState === 'recording'
                  ? 'bg-destructive/15 text-destructive'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <Mic className={`h-4 w-4 ${dictationState === 'recording' ? 'animate-pulse' : ''}`} />
            </button>
            {dictationState === 'recording' && (
              <span className="pointer-events-none absolute right-10 top-3.5 text-xs font-medium text-destructive animate-pulse">
                {t('dictation.listening')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
