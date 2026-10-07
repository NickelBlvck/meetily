"use client";

import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Copy, FilePlus2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfig } from '@/contexts/ConfigContext';

interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  custom: boolean;
}

const EMPTY_TEMPLATE_JSON = JSON.stringify(
  {
    name: 'My Template',
    description: 'Custom meeting summary template',
    sections: [
      {
        title: 'Summary',
        instruction: 'Concise overview of the meeting',
        format: 'paragraph',
      },
      {
        title: 'Action Items',
        instruction: 'List action items with owners and deadlines',
        format: 'list',
      },
    ],
  },
  null,
  2
);

/**
 * Settings tab for editing summary templates.
 *
 * Templates are JSON files; custom overrides live in the app data directory
 * and take precedence over the bundled/built-in ones. Editing writes an
 * override, "Reset" deletes it and restores the built-in template.
 */
export function SummaryTemplatesSettings() {
  const { t } = useConfig();
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [newId, setNewId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadList = useCallback(async (selectId?: string) => {
    try {
      const list = await invoke<TemplateInfo[]>('api_list_templates');
      setTemplates(list);
      const target = selectId ?? list[0]?.id ?? null;
      if (target) {
        setSelectedId(target);
        const raw = await invoke<string>('api_get_template_json', { templateId: target });
        setJsonText(JSON.stringify(JSON.parse(raw), null, 2));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      toast.error('Failed to load templates');
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSelect = useCallback(
    async (id: string) => {
      try {
        const raw = await invoke<string>('api_get_template_json', { templateId: id });
        setSelectedId(id);
        setJsonText(JSON.stringify(JSON.parse(raw), null, 2));
        setIsNew(false);
        setNewId('');
      } catch (error) {
        toast.error('Failed to load template', {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    const id = isNew ? newId.trim() : selectedId;
    if (!id) return;

    // Client-side JSON sanity check so the editor shows a friendlier error
    try {
      JSON.parse(jsonText);
    } catch {
      toast.error('Invalid JSON');
      return;
    }

    setIsSaving(true);
    try {
      await invoke('api_save_template', { templateId: id, templateJson: jsonText });
      toast.success('Template saved', { description: `"${id}" will be used for new summaries` });
      window.dispatchEvent(new CustomEvent('templates-updated'));
      setIsNew(false);
      setNewId('');
      await loadList(id);
    } catch (error) {
      toast.error('Failed to save template', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  }, [isNew, newId, selectedId, jsonText, loadList]);

  const handleReset = useCallback(async () => {
    if (!selectedId) return;
    try {
      await invoke('api_delete_template_override', { templateId: selectedId });
      toast.success('Override removed', {
        description: `"${selectedId}" restored to the built-in version`,
      });
      window.dispatchEvent(new CustomEvent('templates-updated'));
      await loadList(selectedId);
    } catch (error) {
      toast.error('Failed to reset template', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [selectedId, loadList]);

  const handleCreate = useCallback(() => {
    setSelectedId(null);
    setJsonText(EMPTY_TEMPLATE_JSON);
    setIsNew(true);
    setNewId('');
  }, []);

  const handleDuplicate = useCallback(() => {
    setJsonText(jsonText);
    setIsNew(true);
    setNewId(selectedId ? `${selectedId}-copy` : '');
  }, [jsonText, selectedId]);

  const isCustom = selectedId ? templates.find(tpl => tpl.id === selectedId)?.custom : false;

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-muted-foreground">
        Custom templates override the built-in ones. The JSON must contain
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">name</code>,
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">description</code> and
        <code className="mx-1 rounded bg-muted px-1 py-0.5 text-xs">sections</code>
        (each with title, instruction and format: paragraph, list or string).
      </p>

      <div className="flex flex-wrap gap-2">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => handleSelect(tpl.id)}
            title={tpl.description}
            className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              selectedId === tpl.id && !isNew
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-foreground/80 hover:bg-muted'
            }`}
          >
            <span className="block font-medium">{tpl.name}</span>
            <span className="block text-xs text-muted-foreground">
              {tpl.id}
              {tpl.custom ? ' · custom' : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleCreate}>
            <FilePlus2 />
            New
          </Button>
          {selectedId && !isNew && (
            <Button size="sm" variant="outline" onClick={handleDuplicate}>
              <Copy />
              Duplicate
            </Button>
          )}
          {selectedId && !isNew && isCustom && (
            <Button size="sm" variant="outline" onClick={handleReset}>
              <RotateCcw />
              Reset to default
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isNew && (
              <input
                value={newId}
                onChange={(e) => setNewId(e.target.value)}
                placeholder="template_id"
                className="w-44 px-3 py-1.5 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
              />
            )}
            <Button size="sm" onClick={handleSave} disabled={isSaving || (isNew && !newId.trim())}>
              <Save />
              Save
            </Button>
          </div>
        </div>

        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          spellCheck={false}
          className="w-full h-[420px] px-3 py-2 font-mono text-xs bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        />
      </div>
    </div>
  );
}
