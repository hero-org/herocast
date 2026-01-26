'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AtSign,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Hash,
  Heart,
  Layers,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Search,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useRef } from 'react';
import type { FeedPanelConfig, InboxPanelConfig, PanelConfig } from '@/common/types/workspace.types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { AddPanelPlaceholder } from './AddPanelPlaceholder';
import { PanelContent, type PanelContentHandle } from './PanelContent';
import { PanelErrorBoundary } from './PanelErrorBoundary';

const COLLAPSED_WIDTH = 48; // pixels
const MIN_COLUMN_WIDTH = 320; // pixels
const MAX_PANELS = 5;

/**
 * Get panel title based on config
 */
function getPanelTitle(panel: PanelConfig): string {
  if (panel.type === 'feed') {
    const config = panel.config as FeedPanelConfig;
    switch (config.feedType) {
      case 'trending':
        return 'Trending';
      case 'following':
        return 'Following';
      case 'channel':
        return config.channelName || 'Channel';
      case 'search-list':
        return config.listName || 'Search';
      case 'fid-list':
        return config.listName || 'List';
      default:
        return 'Feed';
    }
  }
  if (panel.type === 'inbox') {
    const config = panel.config as InboxPanelConfig;
    switch (config.tab) {
      case 'replies':
        return 'Replies';
      case 'mentions':
        return 'Mentions';
      case 'likes':
        return 'Likes';
      case 'recasts':
        return 'Recasts';
      case 'follows':
        return 'Follows';
      default:
        return 'Inbox';
    }
  }
  return 'Panel';
}

/**
 * Get panel icon based on config
 */
function getPanelIcon(panel: PanelConfig): React.ReactNode {
  if (panel.type === 'feed') {
    const config = panel.config as FeedPanelConfig;
    switch (config.feedType) {
      case 'trending':
        return <TrendingUp className="h-4 w-4" />;
      case 'following':
        return <Layers className="h-4 w-4" />;
      case 'channel':
        return <Hash className="h-4 w-4" />;
      case 'search-list':
        return <Search className="h-4 w-4" />;
      case 'fid-list':
        return <Users className="h-4 w-4" />;
      default:
        return null;
    }
  }
  if (panel.type === 'inbox') {
    const config = panel.config as InboxPanelConfig;
    switch (config.tab) {
      case 'replies':
        return <MessageCircle className="h-4 w-4" />;
      case 'mentions':
        return <AtSign className="h-4 w-4" />;
      case 'likes':
        return <Heart className="h-4 w-4" />;
      case 'recasts':
        return <Repeat2 className="h-4 w-4" />;
      case 'follows':
        return <UserPlus className="h-4 w-4" />;
      default:
        return null;
    }
  }
  return null;
}

interface SortableColumnProps {
  panel: PanelConfig;
  onToggleCollapse: () => void;
  onClose: () => void;
}

/**
 * SortableColumn - A draggable, collapsible column
 * Uses dnd-kit for drag-to-reorder, CSS for collapse animation
 */
function SortableColumn({ panel, onToggleCollapse, onClose }: SortableColumnProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id });
  const panelContentRef = useRef<PanelContentHandle>(null);

  const isCollapsed = panel.collapsed;

  const handleRefresh = useCallback(() => {
    panelContentRef.current?.refresh();
  }, []);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'width 200ms ease, transform 200ms ease',
    width: isCollapsed ? COLLAPSED_WIDTH : undefined,
    minWidth: isCollapsed ? COLLAPSED_WIDTH : MIN_COLUMN_WIDTH,
    maxWidth: isCollapsed ? COLLAPSED_WIDTH : undefined,
    flex: isCollapsed ? `0 0 ${COLLAPSED_WIDTH}px` : '1 1 0',
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'h-full flex flex-col border-r border-border bg-background overflow-hidden',
        isDragging && 'ring-2 ring-primary/50 shadow-lg'
      )}
    >
      {isCollapsed ? (
        <CollapsedColumn
          title={getPanelTitle(panel)}
          icon={getPanelIcon(panel)}
          onExpand={onToggleCollapse}
          onClose={onClose}
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      ) : (
        <>
          <ColumnHeader
            title={getPanelTitle(panel)}
            icon={getPanelIcon(panel)}
            onCollapse={onToggleCollapse}
            onClose={onClose}
            onRefresh={handleRefresh}
            dragHandleProps={{ ...attributes, ...listeners }}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <PanelErrorBoundary panelId={panel.id}>
              <PanelContent ref={panelContentRef} panel={panel} isCollapsed={false} />
            </PanelErrorBoundary>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Column header for expanded state
 */
function ColumnHeader({
  title,
  icon,
  onCollapse,
  onClose,
  onRefresh,
  dragHandleProps,
}: {
  title: string;
  icon: React.ReactNode;
  onCollapse: () => void;
  onClose: () => void;
  onRefresh: () => void;
  dragHandleProps: Record<string, unknown>;
}) {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-muted/50 px-2 flex-shrink-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <div
          {...dragHandleProps}
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded hover:bg-accent active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
        <span className="truncate text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapse} title="Collapse panel">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
          onClick={onClose}
          title="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Collapsed column - narrow strip with vertical title
 */
function CollapsedColumn({
  title,
  icon,
  onExpand,
  onClose,
  dragHandleProps,
}: {
  title: string;
  icon: React.ReactNode;
  onExpand: () => void;
  onClose: () => void;
  dragHandleProps: Record<string, unknown>;
}) {
  return (
    <div className="flex flex-col h-full w-full items-center py-2 bg-muted/50">
      <div
        {...dragHandleProps}
        className="flex h-6 w-6 cursor-grab items-center justify-center rounded hover:bg-accent active:cursor-grabbing mb-2 flex-shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <button
        onClick={onExpand}
        className="flex-1 flex items-center justify-center w-full hover:bg-accent/50 transition-colors min-h-0"
        title={`Click to expand ${title}`}
      >
        <div className="flex flex-col items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <span
            className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {title}
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
      <button
        onClick={onClose}
        className="mt-2 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors flex-shrink-0"
        title="Close panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * WorkspaceLayout - TweetDeck-style multi-column layout
 *
 * Features:
 * - Horizontal drag-to-reorder columns via dnd-kit
 * - Collapsible columns (shrink to 48px icon strip)
 * - Add panel placeholder
 */
export function WorkspaceLayout() {
  const { layout, addPanel, removePanel, reorderPanels, toggleCollapse } = useWorkspaceStore();
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const canAddPanel = layout.panels.length < MAX_PANELS;

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = layout.panels.findIndex((p) => p.id === active.id);
        const newIndex = layout.panels.findIndex((p) => p.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          reorderPanels(oldIndex, newIndex);
        }
      }
    },
    [layout.panels, reorderPanels]
  );

  // Empty state
  if (layout.panels.length === 0) {
    return (
      <div className="h-full w-full">
        <AddPanelPlaceholder onAddPanel={(type, config) => addPanel(type, config)} />
      </div>
    );
  }

  const activePanel = activeId ? layout.panels.find((p) => p.id === activeId) : null;

  return (
    <div className="h-full w-full flex overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={layout.panels.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          {layout.panels.map((panel) => (
            <SortableColumn
              key={panel.id}
              panel={panel}
              onToggleCollapse={() => toggleCollapse(panel.id)}
              onClose={() => removePanel(panel.id)}
            />
          ))}
        </SortableContext>

        {/* Drag overlay for smoother dragging */}
        <DragOverlay>
          {activePanel ? (
            <div
              className="h-full bg-background border border-border rounded shadow-xl opacity-90"
              style={{ width: activePanel.collapsed ? COLLAPSED_WIDTH : MIN_COLUMN_WIDTH }}
            >
              <div className="p-4 text-sm font-medium">{getPanelTitle(activePanel)}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add panel placeholder */}
      {canAddPanel && (
        <div className="flex-1 min-w-[200px] border-r border-border last:border-r-0">
          <AddPanelPlaceholder onAddPanel={(type, config) => addPanel(type, config)} />
        </div>
      )}
    </div>
  );
}

export default WorkspaceLayout;
