'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useStateStore } from '@json-render/react';
import { PALETTE_LIGHT_HEX, PALETTE_DARK_HEX } from '@farcaster/snap';

// ── Accent context ─────────────────────────────────────

const SnapAccentContext = createContext<{ pageAccent?: string; appearance: 'light' | 'dark' } | null>(null);

export function SnapAccentProvider({
  pageAccent,
  appearance = 'dark',
  children,
}: {
  pageAccent?: string;
  appearance?: 'light' | 'dark';
  children: ReactNode;
}) {
  return <SnapAccentContext.Provider value={{ pageAccent, appearance }}>{children}</SnapAccentContext.Provider>;
}

function useSnapAppearance(): 'light' | 'dark' {
  return useContext(SnapAccentContext)?.appearance ?? 'dark';
}

function useSnapPageAccent(): string | undefined {
  return useContext(SnapAccentContext)?.pageAccent;
}

// ── Palette resolution ─────────────────────────────────

function resolvePaletteHex(name: string | undefined, mode: 'light' | 'dark'): string {
  const map = mode === 'dark' ? PALETTE_DARK_HEX : PALETTE_LIGHT_HEX;
  if (name && name in map) return (map as Record<string, string>)[name];
  return map.purple;
}

export function pickForegroundForBg(hex: string): string {
  const h = hex.replace(/^#/, '');
  if (h.length !== 6) return '#ffffff';
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 180 ? '#0a0a0a' : '#ffffff';
}

// ── Color types ────────────────────────────────────────

export type SnapColors = {
  accent: string;
  accentFg: string;
  accentHover: string;
  outlineHover: string;
  text: string;
  textMuted: string;
  border: string;
  muted: string;
  surface: string;
  inputBorder: string;
  inputBg: string;
  mode: 'light' | 'dark';
  paletteHex: (name: string) => string;
  colorHex: (name: string | undefined) => string;
};

// ── Neutrals ───────────────────────────────────────────

const NEUTRAL_LIGHT = {
  text: '#111111',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  muted: 'rgba(0,0,0,0.06)',
  surface: '#ffffff',
  inputBorder: '#E5E7EB',
  inputBg: 'rgba(0,0,0,0.06)',
};

const NEUTRAL_DARK = {
  text: '#FAFAFA',
  textMuted: '#A1A1AA',
  border: '#2D2D44',
  muted: 'rgba(255,255,255,0.03)',
  surface: '#23262f',
  inputBorder: '#3F3F46',
  inputBg: 'rgba(255,255,255,0.03)',
};

// ── Build colors ───────────────────────────────────────

function buildSnapColors(accentName: string, mode: 'light' | 'dark'): SnapColors {
  const accent = resolvePaletteHex(accentName, mode);
  const accentFg = pickForegroundForBg(accent);
  const neutrals = mode === 'dark' ? NEUTRAL_DARK : NEUTRAL_LIGHT;
  const paletteMap = mode === 'dark' ? PALETTE_DARK_HEX : PALETTE_LIGHT_HEX;

  const accentHover =
    mode === 'light' ? `color-mix(in srgb, ${accent} 82%, #000000)` : `color-mix(in srgb, ${accent} 78%, #ffffff)`;
  const outlineHover = `color-mix(in srgb, ${accent} 14%, ${neutrals.surface})`;

  const paletteHex = (name: string) => resolvePaletteHex(name, mode);
  const colorHex = (name: string | undefined) => {
    if (!name || name === 'accent') return accent;
    if (name in paletteMap) return (paletteMap as Record<string, string>)[name];
    return accent;
  };

  return { accent, accentFg, accentHover, outlineHover, ...neutrals, mode, paletteHex, colorHex };
}

// ── Hook ───────────────────────────────────────────────

export function useSnapColors(): SnapColors {
  const { get } = useStateStore();
  const mode = useSnapAppearance();
  const pageAccent = useSnapPageAccent();
  const fromState = get('/theme/accent');
  const accentRaw = typeof pageAccent === 'string' && pageAccent.length > 0 ? pageAccent : fromState;
  const accentName =
    typeof accentRaw === 'string' && (accentRaw as string).length > 0 ? (accentRaw as string) : 'purple';
  return useMemo(() => buildSnapColors(accentName, mode), [accentName, mode]);
}
