'use client';

import React, { useRef, useCallback } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { type PanelImperativeHandle } from 'react-resizable-panels';
import {
  TrendingUp,
  Layers,
  Hash,
  Search,
  Users,
  MessageCircle,
  AtSign,
  Heart,
  Repeat2,
  UserPlus,
  GripVertical,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { PanelConfig, FeedPanelConfig, InboxPanelConfig } from '@/common/types/workspace.types';
import { PanelContent } from './PanelContent';
import PanelHeader from './PanelHeader';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { AddPanelPlaceholder } from './AddPanelPlaceholder';

const COLLAPSED_SIZE = 4; // Percentage when collapsed (narrow strip)

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

interface SortablePanelProps {
  panel: PanelConfig;
  panelSize: number;
  onToggleCollapse: () => void;
  onClose: () => void;
  panelRef: React.RefObject<PanelImperativeHandle | null>;
}

/**
 * SortablePanel wraps a ResizablePanel with drag-and-drop functionality
 * Uses react-resizable-panels' built-in collapse for proper width reduction
 */
function SortablePanel({ panel, panelSize, onToggleCollapse, onClose, panelRef }: SortablePanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id });

  // Combine drag handle props for the header
  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  const handleToggleCollapse = useCallback(() => {
    if (panelRef.current) {
      if (panel.collapsed) {
        panelRef.current.expand();
      } else {
        panelRef.current.collapse();
      }
    }
    onToggleCollapse();
  }, [panel.collapsed, panelRef, onToggleCollapse]);

  return (
    <ResizablePanel
      ref={panelRef}
      id={panel.id}
      minSize={10}
      defaultSize={panelSize}
      collapsible
      collapsedSize={COLLAPSED_SIZE}
    >
      <div
        ref={setNodeRef}
        className={`flex h-full w-full overflow-hidden border-r border-border last:border-r-0 ${
          panel.collapsed ? 'flex-col' : 'flex-col'
        } ${isDragging ? 'z-50 opacity-90 ring-2 ring-primary/50' : ''}`}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
      >
        {panel.collapsed ? (
          // Collapsed state: vertical header
          <CollapsedPanelHeader
            title={getPanelTitle(panel)}
            icon={getPanelIcon(panel)}
            onExpand={handleToggleCollapse}
            onClose={onClose}
            dragHandleProps={dragHandleProps}
          />
        ) : (
          <>
            <PanelHeader
              title={getPanelTitle(panel)}
              icon={getPanelIcon(panel)}
              isCollapsed={panel.collapsed}
              onToggleCollapse={handleToggleCollapse}
              onClose={onClose}
              dragHandleProps={dragHandleProps}
            />
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
              <PanelErrorBoundary panelId={panel.id}>
                <PanelContent panel={panel} isCollapsed={panel.collapsed} />
              </PanelErrorBoundary>
            </div>
          </>
        )}
      </div>
    </ResizablePanel>
  );
}

/**
 * Collapsed panel header - vertical strip with rotated title
 */
function CollapsedPanelHeader({
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
  dragHandleProps: any;
}) {
  return (
    <div className="flex flex-col h-full w-full items-center py-2 bg-muted/50">
      <div
        {...dragHandleProps}
        className="flex h-6 w-6 cursor-grab items-center justify-center rounded hover:bg-accent active:cursor-grabbing mb-2"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <button
        onClick={onExpand}
        className="flex-1 flex items-center justify-center w-full hover:bg-accent/50 transition-colors"
        title="Expand panel"
      >
        <div className="flex flex-col items-center gap-2">
          {icon && <div className="text-muted-foreground">{icon}</div>}
          <span
            className="text-xs font-medium text-muted-foreground whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {title}
          </span>
        </div>
      </button>
      <button
        onClick={onClose}
        className="mt-2 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
        title="Close panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const MAX_PANELS = 5;

/**
 * WorkspaceLayout orchestrates the entire workspace with:
 * - Multi-panel layout with drag-and-drop reordering
 * - Resizable panels with proper collapse functionality
 * - Inline add panel UI
 * - Empty state handling
 */
export function WorkspaceLayout() {
  const { layout, addPanel, removePanel, reorderPanels, updatePanelSizes, toggleCollapse } = useWorkspaceStore();

  // Create refs for each panel to control collapse programmatically
  const panelRefs = useRef<Map<string, React.RefObject<PanelImperativeHandle | null>>>(new Map());

  // Ensure refs exist for all panels
  const getPanelRef = useCallback((panelId: string) => {
    if (!panelRefs.current.has(panelId)) {
      panelRefs.current.set(panelId, React.createRef<PanelImperativeHandle | null>());
    }
    return panelRefs.current.get(panelId)!;
  }, []);

  const canAddPanel = layout.panels.length < MAX_PANELS;

  // DnD sensors for mouse and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * Handle drag end - reorder panels when dropped
   */
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = layout.panels.findIndex((p) => p.id === active.id);
      const newIndex = layout.panels.findIndex((p) => p.id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderPanels(oldIndex, newIndex);
      }
    }
  }

  /**
   * Handle resize - update panel sizes when user resizes
   * v4 API returns Layout object { [panelId]: percentage }
   */
  function handleLayoutChanged(layoutMap: { [panelId: string]: number }) {
    // Convert layout map to array in panel order, filtering out placeholder
    const sizes = layout.panels.map((panel) => layoutMap[panel.id] || 0);
    updatePanelSizes(sizes);
  }

  // Show empty state if no panels
  if (layout.panels.length === 0) {
    return (
      <div className="h-full w-full">
        <AddPanelPlaceholder onAddPanel={(type, config) => addPanel(type, config)} />
      </div>
    );
  }

  // Calculate sizes - ensure they sum to 100%
  const totalPanels = layout.panels.length + (canAddPanel ? 1 : 0);
  const placeholderSize = canAddPanel ? Math.max(10, Math.floor(100 / totalPanels)) : 0;
  const availableForPanels = 100 - placeholderSize;

  return (
    <div className="h-full w-full overflow-hidden">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.panels.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <ResizablePanelGroup direction="horizontal" onLayoutChanged={handleLayoutChanged}>
            {layout.panels.map((panel, index) => {
              // Calculate proportional size within available space
              const baseSize = layout.panelSizes[index] || availableForPanels / layout.panels.length;
              return (
                <React.Fragment key={panel.id}>
                  <SortablePanel
                    panel={panel}
                    panelSize={baseSize}
                    onToggleCollapse={() => toggleCollapse(panel.id)}
                    onClose={() => removePanel(panel.id)}
                    panelRef={getPanelRef(panel.id)}
                  />
                  <ResizableHandle withHandle />
                </React.Fragment>
              );
            })}
            {/* Inline add panel placeholder */}
            {canAddPanel && (
              <ResizablePanel id="add-panel-placeholder" minSize={8} defaultSize={placeholderSize}>
                <AddPanelPlaceholder onAddPanel={(type, config) => addPanel(type, config)} />
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default WorkspaceLayout;
