"use client";

import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

interface PromptOverrides {
  normalization?: string | null;
  translation?: string | null;
  final_report?: string | null;
}

interface DefaultPrompts {
  normalization: string;
  translation: string;
  final_report: string;
}

const FIELDS = [
  {
    key: 'normalization' as const,
    title: 'English normalization prompt',
    description:
      'System prompt for the pass that converts the summary into English. Replaces the default entirely when filled in.',
  },
  {
    key: 'translation' as const,
    title: 'Translation prompt',
    description:
      'System prompt for translating the summary. Optional placeholder: {target_language}.',
  },
  {
    key: 'final_report' as const,
    title: 'Final report prompt',
    description:
      'Main summary system prompt. Optional placeholders: {section_instructions}, {clean_template_markdown}.',
  },
];

export function SummaryPromptsSettings() {
  const [overrides, setOverrides] = useState<PromptOverrides>({});
  const [defaults, setDefaults] = useState<DefaultPrompts | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [ovr, def] = await Promise.all([
          invoke<PromptOverrides>('api_get_summary_prompt_overrides'),
          invoke<DefaultPrompts>('api_get_default_summary_prompts'),
        ]);
        setOverrides({
          normalization: ovr?.normalization ?? '',
          translation: ovr?.translation ?? '',
          final_report: ovr?.final_report ?? '',
        });
        setDefaults(def);
      } catch (error) {
        console.error('Failed to load summary prompts:', error);
        toast.error('Failed to load summary prompts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('api_save_summary_prompt_overrides', {
        normalization: overrides.normalization?.trim() || null,
        translation: overrides.translation?.trim() || null,
        finalReport: overrides.final_report?.trim() || null,
      });
      toast.success('Summary prompts saved');
    } catch (error) {
      console.error('Failed to save summary prompts:', error);
      toast.error('Failed to save summary prompts');
    } finally {
      setSaving(false);
    }
  };

  const handleResetField = (key: keyof PromptOverrides) => {
    setOverrides(prev => ({ ...prev, [key]: '' }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="animate-spin mr-2" />
        Loading prompts...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-2">Summary System Prompts</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Customize the system prompts used by the AI summary pipeline. Leave a field empty to use
          the built-in default (shown as placeholder). Saved prompts apply to all new summaries.
        </p>

        <div className="space-y-6">
          {FIELDS.map(field => (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-foreground">{field.title}</label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => handleResetField(field.key)}
                  title="Reset to default"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{field.description}</p>
              <textarea
                value={overrides[field.key] ?? ''}
                onChange={e =>
                  setOverrides(prev => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={defaults?.[field.key] ?? ''}
                rows={8}
                className="w-full rounded-md border border-border bg-background text-foreground text-sm font-mono p-3 focus:outline-none focus:ring-1 focus:ring-ring resize-y"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2" />
                Save Prompts
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
