"use client";

import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Copy, Save, Loader2, FileDown, BookMarked } from 'lucide-react';
import Analytics from '@/lib/analytics';
import { useConfig } from '@/contexts/ConfigContext';

interface SummaryUpdaterButtonGroupProps {
  isSaving: boolean;
  isDirty: boolean;
  onSave: () => Promise<void>;
  onCopy: () => Promise<void>;
  onExportMarkdown: () => Promise<void>;
  onExportObsidian: () => Promise<void>;
}

export function SummaryUpdaterButtonGroup({
  isSaving,
  isDirty,
  onSave,
  onCopy,
  onExportMarkdown,
  onExportObsidian,
}: SummaryUpdaterButtonGroupProps) {
  const { t } = useConfig();
  return (
    <ButtonGroup>
      {/* Save button */}
      <Button
        variant="outline"
        size="sm"
        className={`${isDirty ? 'bg-green-200' : ""}`}
        title={isSaving ? "Saving" : "Save Changes"}
        onClick={() => {
          Analytics.trackButtonClick('save_changes', 'meeting_details');
          onSave();
        }}
        disabled={isSaving}
      >
        {isSaving ? (
          <>
            <Loader2 className="animate-spin" />
            <span className="hidden @[40rem]:inline">Saving...</span>
          </>
        ) : (
          <>
            <Save />
            <span className="hidden @[40rem]:inline">Save</span>
          </>
        )}
      </Button>

      {/* Copy button */}
      <Button
        variant="outline"
        size="sm"
        title="Copy Summary"
        onClick={() => {
          Analytics.trackButtonClick('copy_summary', 'meeting_details');
          onCopy();
        }}
        className="cursor-pointer"
      >
        <Copy />
        <span className="hidden @[40rem]:inline">Copy</span>
      </Button>

      {/* Export to Markdown file */}
      <Button
        variant="outline"
        size="sm"
        title={t('meeting.exportMarkdownTitle')}
        onClick={() => {
          Analytics.trackButtonClick('export_markdown', 'meeting_details');
          onExportMarkdown();
        }}
        className="cursor-pointer"
      >
        <FileDown />
        <span className="hidden @[40rem]:inline">Export .md</span>
      </Button>

      {/* Export to Obsidian vault */}
      <Button
        variant="outline"
        size="sm"
        title={t('meeting.exportObsidianTitle')}
        onClick={() => {
          Analytics.trackButtonClick('export_obsidian', 'meeting_details');
          onExportObsidian();
        }}
        className="cursor-pointer"
      >
        <BookMarked />
        <span className="hidden @[40rem]:inline">Obsidian</span>
      </Button>

    </ButtonGroup>
  );
}
