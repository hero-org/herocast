import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { FeedPanelConfig, InboxPanelConfig, PanelConfig } from '@/common/types/workspace.types';
import FeedPanel, { type FeedPanelHandle } from './panels/FeedPanel';
import InboxPanel, { type InboxPanelHandle } from './panels/InboxPanel';

export interface PanelContentHandle {
  refresh: () => void;
}

interface PanelContentProps {
  panel: PanelConfig;
  isCollapsed: boolean;
}

/**
 * Routes panel types to their respective components.
 * This is a simple router - each panel type handles its own rendering logic.
 * Exposes a refresh() method via ref for parent components.
 */
export const PanelContent = forwardRef<PanelContentHandle, PanelContentProps>(({ panel, isCollapsed }, ref) => {
  const feedPanelRef = useRef<FeedPanelHandle>(null);
  const inboxPanelRef = useRef<InboxPanelHandle>(null);

  useImperativeHandle(ref, () => ({
    refresh: () => {
      if (panel.type === 'feed' && feedPanelRef.current) {
        feedPanelRef.current.refresh();
      } else if (panel.type === 'inbox' && inboxPanelRef.current) {
        inboxPanelRef.current.refresh();
      }
    },
  }));

  switch (panel.type) {
    case 'feed':
      return (
        <FeedPanel
          ref={feedPanelRef}
          config={panel.config as FeedPanelConfig}
          isCollapsed={isCollapsed}
          panelId={panel.id}
        />
      );

    case 'inbox':
      return (
        <InboxPanel
          ref={inboxPanelRef}
          config={panel.config as InboxPanelConfig}
          isCollapsed={isCollapsed}
          panelId={panel.id}
        />
      );

    default:
      return <div className="flex items-center justify-center h-full text-muted-foreground">Unknown panel type</div>;
  }
});

PanelContent.displayName = 'PanelContent';
