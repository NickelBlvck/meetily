import { useCallback, RefObject } from 'react';
import { MeetingSummary, Transcript } from '@/types';
import { BlockNoteSummaryViewRef } from '@/components/AISummary/BlockNoteSummaryView';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';
import { invoke as invokeTauri } from '@tauri-apps/api/core';
import { hasVisibleSummaryContent } from '@/lib/summary-content';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, exists } from '@tauri-apps/plugin-fs';

const OBSIDIAN_VAULT_PATH_KEY = 'obsidianVaultPath';

interface UseCopyOperationsProps {
  meeting: any;
  transcripts: Transcript[];
  meetingTitle: string;
  aiSummary: MeetingSummary | null;
  blockNoteSummaryRef: RefObject<BlockNoteSummaryViewRef>;
}

export function useCopyOperations({
  meeting,
  transcripts,
  meetingTitle,
  aiSummary,
  blockNoteSummaryRef,
}: UseCopyOperationsProps) {

  // Helper function to fetch ALL transcripts for copying (not just paginated data)
  const fetchAllTranscripts = useCallback(async (meetingId: string): Promise<Transcript[]> => {
    try {
      console.log('📊 Fetching all transcripts for copying:', meetingId);

      // First, get total count by fetching first page
      const firstPage = await invokeTauri('api_get_meeting_transcripts', {
        meetingId,
        limit: 1,
        offset: 0,
      }) as { transcripts: Transcript[]; total_count: number; has_more: boolean };

      const totalCount = firstPage.total_count;
      console.log(`📊 Total transcripts in database: ${totalCount}`);

      if (totalCount === 0) {
        return [];
      }

      // Fetch all transcripts in one call
      const allData = await invokeTauri('api_get_meeting_transcripts', {
        meetingId,
        limit: totalCount,
        offset: 0,
      }) as { transcripts: Transcript[]; total_count: number; has_more: boolean };

      console.log(`✅ Fetched ${allData.transcripts.length} transcripts from database for copying`);
      return allData.transcripts;
    } catch (error) {
      console.error('❌ Error fetching all transcripts:', error);
      toast.error('Failed to fetch transcripts for copying');
      return [];
    }
  }, []);

  // Copy transcript to clipboard
  const handleCopyTranscript = useCallback(async () => {
    // CHANGE: Fetch ALL transcripts from database, not from pagination state
    console.log('📊 Fetching all transcripts for copying...');
    const allTranscripts = await fetchAllTranscripts(meeting.id);

    if (!allTranscripts.length) {
      const error_msg = 'No transcripts available to copy';
      console.log(error_msg);
      toast.error(error_msg);
      return;
    }

    console.log(`✅ Copying ${allTranscripts.length} transcripts to clipboard`);

    // Format timestamps as recording-relative [MM:SS] instead of wall-clock time
    const formatTime = (seconds: number | undefined, fallbackTimestamp: string): string => {
      if (seconds === undefined) {
        // For old transcripts without audio_start_time, use wall-clock time
        return fallbackTimestamp;
      }
      const totalSecs = Math.floor(seconds);
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
    };

    const header = `# Transcript of the Meeting: ${meeting.id} - ${meetingTitle ?? meeting.title}\n\n`;
    const date = `## Date: ${new Date(meeting.created_at).toLocaleDateString()}\n\n`;
    const fullTranscript = allTranscripts
      .map(t => `${formatTime(t.audio_start_time, t.timestamp)} ${t.text}  `)
      .join('\n');

    await navigator.clipboard.writeText(header + date + fullTranscript);
    toast.success("Transcript copied to clipboard");

    // Track copy analytics
    const wordCount = allTranscripts
      .map(t => t.text.split(/\s+/).length)
      .reduce((a, b) => a + b, 0);

    await Analytics.trackCopy('transcript', {
      meeting_id: meeting.id,
      transcript_length: allTranscripts.length.toString(),
      word_count: wordCount.toString()
    });
  }, [meeting, meetingTitle, fetchAllTranscripts]);

  // Build summary markdown body from the BlockNote editor (preferred) or stored summary
  const getSummaryMarkdownBody = useCallback(async (): Promise<string> => {
    let summaryMarkdown = '';

    // Try to get markdown from BlockNote editor first
    if (blockNoteSummaryRef.current?.getMarkdown) {
      try {
        summaryMarkdown = await blockNoteSummaryRef.current.getMarkdown();
      } catch (e) {
        console.warn('Failed to get markdown from editor ref:', e);
      }
    }

    // Fallback: Check if aiSummary has markdown property
    if (!summaryMarkdown && aiSummary && typeof aiSummary.markdown === 'string') {
      summaryMarkdown = aiSummary.markdown;
    }

    // Fallback: Check for legacy format
    if (!summaryMarkdown && aiSummary) {
      const sections = Object.entries(aiSummary)
        .filter(([key]) => {
          // Skip non-section keys
          return key !== 'markdown' && key !== 'summary_json' && key !== '_section_order' && key !== 'MeetingName';
        })
        .map(([, section]) => {
          if (section && typeof section === 'object' && 'title' in section && 'blocks' in section) {
            const sectionTitle = `## ${section.title}\n\n`;
            const sectionContent = section.blocks
              .map((block: any) => `- ${block.content}`)
              .join('\n');
            return sectionTitle + sectionContent;
          }
          return '';
        })
        .filter(s => s.trim())
        .join('\n\n');
      summaryMarkdown = sections;
    }

    return summaryMarkdown;
  }, [aiSummary, blockNoteSummaryRef]);

  // Build the full export document: title + metadata + summary body
  const buildFullSummaryMarkdown = useCallback(async (): Promise<string | null> => {
    if (!hasVisibleSummaryContent(aiSummary)) {
      toast.error('No summary content available to export');
      return null;
    }

    const summaryMarkdown = await getSummaryMarkdownBody();
    if (!summaryMarkdown.trim()) {
      toast.error('No summary content available to export');
      return null;
    }

    const header = `# Meeting Summary: ${meetingTitle}\n\n`;
    const metadata = `**Meeting ID:** ${meeting.id}\n**Date:** ${new Date(meeting.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n**Exported on:** ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n\n---\n\n`;

    return header + metadata + summaryMarkdown;
  }, [aiSummary, meetingTitle, meeting, getSummaryMarkdownBody]);

  // Copy summary to clipboard
  const handleCopySummary = useCallback(async () => {
    try {
      const fullMarkdown = await buildFullSummaryMarkdown();
      if (!fullMarkdown) return;

      await navigator.clipboard.writeText(fullMarkdown);
      console.log('✅ Successfully copied to clipboard!');
      toast.success("Summary copied to clipboard");

      // Track copy analytics
      await Analytics.trackCopy('summary', {
        meeting_id: meeting.id,
        has_markdown: (!!aiSummary && 'markdown' in aiSummary).toString()
      });
    } catch (error) {
      console.error('❌ Failed to copy summary:', error);
      toast.error("Failed to copy summary");
    }
  }, [buildFullSummaryMarkdown, meeting, aiSummary]);

  // Default export file name: "2026-10-05 My Meeting.md"
  const defaultFileName = useCallback(() => {
    const date = new Date(meeting.created_at || Date.now());
    const ymd = date.toISOString().slice(0, 10);
    const safeTitle = (meetingTitle || 'Meeting').replace(/[<>:"/\\|?*]/g, '-').slice(0, 120).trim();
    return `${ymd} ${safeTitle}.md`;
  }, [meeting.created_at, meetingTitle]);

  // Export summary as .md file via save dialog
  const handleExportMarkdown = useCallback(async () => {
    try {
      const fullMarkdown = await buildFullSummaryMarkdown();
      if (!fullMarkdown) return;

      const filePath = await save({
        title: 'Export Summary as Markdown',
        defaultPath: defaultFileName(),
        filters: [{ name: 'Markdown', extensions: ['md'] }],
      });
      if (!filePath) return;

      await writeTextFile(filePath, fullMarkdown);
      toast.success(`Summary exported to ${filePath}`);
      await Analytics.track('summary_exported', { target: 'markdown_file' });
    } catch (error) {
      console.error('❌ Failed to export summary:', error);
      toast.error('Failed to export summary');
    }
  }, [buildFullSummaryMarkdown, defaultFileName]);

  // Export summary into an Obsidian vault folder
  const handleExportObsidian = useCallback(async () => {
    try {
      const fullMarkdown = await buildFullSummaryMarkdown();
      if (!fullMarkdown) return;

      let vaultPath = localStorage.getItem(OBSIDIAN_VAULT_PATH_KEY);

      if (!vaultPath) {
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Choose Obsidian Vault Folder',
        });
        if (!selected || typeof selected !== 'string') return;
        vaultPath = selected;
        localStorage.setItem(OBSIDIAN_VAULT_PATH_KEY, vaultPath);
      } else if (!(await exists(vaultPath))) {
        // Stored folder is gone — ask again
        localStorage.removeItem(OBSIDIAN_VAULT_PATH_KEY);
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Choose Obsidian Vault Folder',
        });
        if (!selected || typeof selected !== 'string') return;
        vaultPath = selected;
        localStorage.setItem(OBSIDIAN_VAULT_PATH_KEY, vaultPath);
      }

      const fileName = defaultFileName();
      const frontMatter = `---\ntitle: ${meetingTitle}\ndate: ${new Date(meeting.created_at || Date.now()).toISOString()}\ntags: [meeting]\n---\n\n`;
      const filePath = `${vaultPath}/${fileName}`.replace(/\\/g, '/');

      if (await exists(filePath)) {
        toast.error(`Note already exists: ${fileName}`);
        return;
      }

      await writeTextFile(filePath, frontMatter + fullMarkdown);
      toast.success(`Saved to Obsidian vault: ${fileName}`);
      await Analytics.track('summary_exported', { target: 'obsidian' });
    } catch (error) {
      console.error('❌ Failed to export to Obsidian:', error);
      toast.error('Failed to export to Obsidian');
    }
  }, [buildFullSummaryMarkdown, defaultFileName, meeting, meetingTitle]);

  return {
    handleCopyTranscript,
    handleCopySummary,
    handleExportMarkdown,
    handleExportObsidian,
  };
}
