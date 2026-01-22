'use client';

import React from 'react';
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
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
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { PanelConfig, FeedPanelConfig, InboxPanelConfig } from '@/common/types/workspace.types';
import { PanelContent } from './PanelContent';
import PanelHeader from './PanelHeader';
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { AddPanelPlaceholder } from './AddPanelPlaceholder';

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
}

/**
 * SortablePanel wraps a ResizablePanel with drag-and-drop functionality
 * Note: dnd-kit transform is applied to the inner wrapper, not ResizablePanel itself,
 * since react-resizable-panels manages its own sizing
 */
function SortablePanel({ panel, panelSize, onToggleCollapse, onClose }: SortablePanelProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: panel.id });

  // Combine drag handle props for the header
  const dragHandleProps = {
    ...attributes,
    ...listeners,
  };

  return (
    <ResizablePanel minSize={10} defaultSize={panelSize}>
      <div
        ref={setNodeRef}
        className={`flex flex-col h-full w-full overflow-hidden border-r border-border last:border-r-0 ${isDragging ? 'z-50 opacity-90 ring-2 ring-primary/50' : ''}`}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
        }}
      >
        <PanelHeader
          title={getPanelTitle(panel)}
          icon={getPanelIcon(panel)}
          isCollapsed={panel.collapsed}
          onToggleCollapse={onToggleCollapse}
          onClose={onClose}
          dragHandleProps={dragHandleProps}
        />
        <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
          <PanelErrorBoundary panelId={panel.id}>
            <PanelContent panel={panel} isCollapsed={panel.collapsed} />
          </PanelErrorBoundary>
        </div>
      </div>
    </ResizablePanel>
  );
}

const MAX_PANELS = 5;

/**
 * WorkspaceLayout orchestrates the entire workspace with:
 * - Multi-panel layout with drag-and-drop reordering
 * - Resizable panels
 * - Inline add panel UI
 * - Empty state handling
 */
export function WorkspaceLayout() {
  const { layout, addPanel, removePanel, reorderPanels, updatePanelSizes, toggleCollapse } = useWorkspaceStore();

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
    // Convert layout map to array in panel order
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

  // Calculate sizes for panels + placeholder
  const totalPanels = layout.panels.length + (canAddPanel ? 1 : 0);
  const placeholderSize = canAddPanel ? Math.floor(100 / totalPanels) : 0;

  return (
    <div className="h-full w-full overflow-hidden">
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.panels.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <ResizablePanelGroup direction="horizontal" onLayoutChanged={handleLayoutChanged}>
            {layout.panels.map((panel, index) => (
              <React.Fragment key={panel.id}>
                <SortablePanel
                  panel={panel}
                  panelSize={layout.panelSizes[index] || 100 / totalPanels}
                  onToggleCollapse={() => toggleCollapse(panel.id)}
                  onClose={() => removePanel(panel.id)}
                />
                <ResizableHandle withHandle />
              </React.Fragment>
            ))}
            {/* Inline add panel placeholder */}
            {canAddPanel && (
              <ResizablePanel minSize={15} defaultSize={placeholderSize}>
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
