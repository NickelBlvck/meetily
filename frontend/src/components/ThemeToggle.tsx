'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';

const ORDER = ['light', 'dark', 'system'] as const;
const META = {
  light: { icon: Sun, label: 'Light' },
  dark: { icon: Moon, label: 'Dark' },
  system: { icon: Monitor, label: 'System' },
} as const;

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={className} />;
  }

  const current = (ORDER.includes(theme as any) ? theme : 'system') as keyof typeof META;
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = META[current].icon;

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Theme: ${META[current].label} (click to switch to ${META[next].label})`}
      className={`inline-flex items-center justify-center rounded-lg transition-colors duration-150 hover:bg-accent text-muted-foreground ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
