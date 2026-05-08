'use client';

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PALETTE_LIGHT_HEX, PALETTE_DARK_HEX } from '@farcaster/snap';
import { HerocastSnapRenderer } from './catalog';
import { SnapAccentProvider } from './useSnapColors';

// ── Types ──────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type SnapPage = {
  version: string;
  theme?: { accent?: string };
  effects?: string[];
  ui: { root: string; elements: Record<string, unknown>; state?: Record<string, unknown> };
};

export type SnapActionHandlers = {
  submit: (target: string, inputs: Record<string, JsonValue>) => void;
  open_url: (target: string) => void;
  open_snap: (target: string) => void;
  open_mini_app: (target: string) => void;
  view_cast: (params: { hash: string }) => void;
  view_profile: (params: { fid: number }) => void;
  compose_cast: (params: { text?: string; channelKey?: string; embeds?: string[] }) => void;
  view_token: (params: { token: string }) => void;
  send_token: (params: { token: string; amount?: string; recipientFid?: number; recipientAddress?: string }) => void;
  swap_token: (params: { sellToken?: string; buyToken?: string }) => void;
};

// ── State helpers ──────────────────────────────────────

function applyStatePaths(model: Record<string, unknown>, changes: Array<{ path: string; value: unknown }>) {
  for (const { path, value } of changes) {
    const trimmed = path.startsWith('/') ? path : `/${path}`;
    const parts = trimmed.split('/').filter(Boolean);
    if (parts.length < 2) continue;
    const [top, ...rest] = parts;
    if (top === 'inputs') {
      if (typeof model.inputs !== 'object' || model.inputs === null) model.inputs = {};
      if (rest.length === 1) (model.inputs as Record<string, unknown>)[rest[0]] = value;
    } else if (top === 'theme') {
      if (typeof model.theme !== 'object' || model.theme === null) model.theme = {};
      if (rest.length === 1) (model.theme as Record<string, unknown>)[rest[0]] = value;
    }
  }
}

// ── Palette resolution ─────────────────────────────────

function resolvePaletteHex(name: string, appearance: 'light' | 'dark'): string {
  const map = appearance === 'dark' ? PALETTE_DARK_HEX : PALETTE_LIGHT_HEX;
  if (name in map) return (map as Record<string, string>)[name];
  return map.purple;
}

// ── Loading overlay ────────────────────────────────────

function LoadingOverlay({ appearance, accentHex, active }: { appearance: string; accentHex: string; active: boolean }) {
  const isDark = appearance === 'dark';
  const tint = isDark ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';
  const track = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        background: tint,
        backdropFilter: active ? 'blur(10px)' : 'none',
        opacity: active ? 1 : 0,
        pointerEvents: active ? 'auto' : 'none',
        transition: 'opacity 0.28s ease',
      }}
      aria-hidden={!active}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          border: `2.5px solid ${track}`,
          borderTopColor: accentHex,
          animation: 'snapSpin 0.75s linear infinite',
        }}
      />
      <style>{`@keyframes snapSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Confetti overlay ───────────────────────────────────

const CONFETTI_COLORS = ['#907AA9', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];

function ConfettiOverlay() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.5 + Math.random() * 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        size: 6 + Math.random() * 8,
        rotation: Math.random() * 360,
      })),
    []
  );

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 20 }}>
      {pieces.map(({ id, left, delay, duration, color, size, rotation }) => (
        <div
          key={id}
          style={{
            position: 'absolute',
            left: `${left}%`,
            top: -20,
            width: size,
            height: size * 0.6,
            backgroundColor: color,
            borderRadius: 2,
            transform: `rotate(${rotation}deg)`,
            animation: `confettiFall ${duration}s ease-in ${delay}s forwards`,
          }}
        />
      ))}
      <style>{`@keyframes confettiFall{0%{top:-20px;opacity:1}50%{opacity:1}100%{top:110%;opacity:0;transform:rotate(720deg)}}`}</style>
    </div>
  );
}

// ── SnapView ───────────────────────────────────────────

export function SnapView({
  snap,
  handlers,
  loading = false,
  appearance = 'dark',
  actionError,
}: {
  snap: SnapPage;
  handlers: SnapActionHandlers;
  loading?: boolean;
  appearance?: 'light' | 'dark';
  actionError?: string | null;
}) {
  const spec = snap.ui;
  const initialState = useMemo(() => (spec.state as Record<string, unknown>) ?? { inputs: {} }, [spec]);
  const stateRef = useRef(initialState);

  useEffect(() => {
    stateRef.current = {
      inputs: { ...((initialState.inputs as Record<string, unknown>) ?? {}) },
      theme: { ...((initialState.theme as Record<string, unknown>) ?? {}) },
    };
  }, [initialState]);

  const [pageKey, setPageKey] = useState(0);
  useEffect(() => setPageKey((k) => k + 1), [spec]);

  const showConfetti = snap.effects?.includes('confetti');
  const accentName = snap.theme?.accent ?? 'purple';
  const accentHex = useMemo(() => resolvePaletteHex(accentName, appearance), [accentName, appearance]);

  const handleAction = useCallback(
    (name: string, params?: Record<string, unknown>) => {
      const inputs = (stateRef.current.inputs ?? {}) as Record<string, JsonValue>;
      const p = (params ?? {}) as Record<string, unknown>;
      switch (name) {
        case 'submit':
          handlers.submit(String(p.target ?? ''), inputs);
          break;
        case 'open_url':
          handlers.open_url(String(p.target ?? ''));
          break;
        case 'open_snap':
          handlers.open_snap(String(p.target ?? ''));
          break;
        case 'open_mini_app':
          handlers.open_mini_app(String(p.target ?? ''));
          break;
        case 'view_cast':
          handlers.view_cast({ hash: String(p.hash ?? '') });
          break;
        case 'view_profile':
          handlers.view_profile({ fid: Number(p.fid ?? 0) });
          break;
        case 'compose_cast':
          handlers.compose_cast({
            text: p.text ? String(p.text) : undefined,
            channelKey: p.channelKey ? String(p.channelKey) : undefined,
            embeds: Array.isArray(p.embeds) ? p.embeds : undefined,
          });
          break;
        case 'view_token':
          handlers.view_token({ token: String(p.token ?? '') });
          break;
        case 'send_token':
          handlers.send_token({
            token: String(p.token ?? ''),
            amount: p.amount ? String(p.amount) : undefined,
            recipientFid: p.recipientFid ? Number(p.recipientFid) : undefined,
            recipientAddress: p.recipientAddress ? String(p.recipientAddress) : undefined,
          });
          break;
        case 'swap_token':
          handlers.swap_token({
            sellToken: p.sellToken ? String(p.sellToken) : undefined,
            buyToken: p.buyToken ? String(p.buyToken) : undefined,
          });
          break;
      }
    },
    [handlers]
  );

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border"
      style={{
        maxHeight: 500,
        backgroundColor: appearance === 'dark' ? '#23262f' : '#ffffff',
        borderColor: appearance === 'dark' ? '#2D2D44' : '#E5E7EB',
      }}
    >
      {showConfetti && <ConfettiOverlay />}
      <LoadingOverlay appearance={appearance} accentHex={accentHex} active={loading} />
      <div className="p-4">
        <SnapAccentProvider pageAccent={snap.theme?.accent} appearance={appearance}>
          <HerocastSnapRenderer
            key={pageKey}
            spec={spec as any}
            state={initialState}
            loading={false}
            onStateChange={(changes: Array<{ path: string; value: unknown }>) => {
              applyStatePaths(stateRef.current, changes);
            }}
            onAction={handleAction}
          />
        </SnapAccentProvider>
      </div>
      {actionError && (
        <div
          className="border-t px-4 py-2 text-sm text-red-500"
          style={{ borderColor: appearance === 'dark' ? '#2D2D44' : '#E5E7EB' }}
        >
          {actionError}
        </div>
      )}
    </div>
  );
}
