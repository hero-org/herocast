'use client';

import React from 'react';
import { useStateStore } from '@json-render/react';
import { useSnapColors } from '../useSnapColors';

type Cell = { row: number; col: number; color?: string; content?: string };

const GAP_PX = { none: 0, sm: 1, md: 2, lg: 4 } as const;

export function SnapCellGrid({ element: { props } }: { element: { props: Record<string, unknown> } }) {
  const { get, set } = useStateStore();
  const colors = useSnapColors();
  const cols = Number(props.cols ?? 4);
  const rows = Number(props.rows ?? 4);
  const cells = (props.cells as Cell[]) ?? [];
  const gap = GAP_PX[String(props.gap ?? 'sm') as keyof typeof GAP_PX] ?? 1;
  const rowHeight = Number(props.rowHeight ?? 28);
  const selectMode = String(props.select ?? 'off');
  const name = String(props.name ?? 'grid_tap');
  const path = `/inputs/${name}`;

  const rawSelection = get(path) as string | undefined;
  const selectedSet = new Set(rawSelection ? rawSelection.split('|') : []);

  const cellMap = new Map<string, Cell>();
  for (const c of cells) cellMap.set(`${c.row},${c.col}`, c);

  const handleTap = (row: number, col: number) => {
    if (selectMode === 'off') return;
    const key = `${row},${col}`;
    if (selectMode === 'single') {
      set(path, key);
    } else {
      const next = new Set(selectedSet);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      set(path, [...next].join('|'));
    }
  };

  const gridCells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const cell = cellMap.get(key);
      const isSelected = selectedSet.has(key);
      const bg = cell?.color ? colors.colorHex(cell.color) : colors.muted;

      gridCells.push(
        <button
          key={key}
          type="button"
          className="flex items-center justify-center text-xs font-medium"
          style={{
            backgroundColor: bg,
            height: rowHeight,
            color: cell?.color ? '#fff' : colors.textMuted,
            boxShadow: isSelected ? `inset 0 0 0 2px ${colors.accent}` : undefined,
            cursor: selectMode !== 'off' ? 'pointer' : 'default',
          }}
          onClick={() => handleTap(r, c)}
          disabled={selectMode === 'off'}
        >
          {cell?.content ?? ''}
        </button>
      );
    }
  }

  return (
    <div
      className="w-full overflow-hidden rounded"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${gap}px`,
      }}
    >
      {gridCells}
    </div>
  );
}
