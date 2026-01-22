import React from 'react';
import { PanelConfig, FeedPanelConfig, InboxPanelConfig } from '@/common/types/workspace.types';
import FeedPanel from './panels/FeedPanel';
import InboxPanel from './panels/InboxPanel';

interface PanelContentProps {
  panel: PanelConfig;
  isCollapsed: boolean;
}

/**
 * Routes panel types to their respective components.
 * This is a simple router - each panel type handles its own rendering logic.
 */
export function PanelContent({ panel, isCollapsed }: PanelContentProps) {
  switch (panel.type) {
    case 'feed':
      return <FeedPanel config={panel.config as FeedPanelConfig} isCollapsed={isCollapsed} panelId={panel.id} />;

    case 'inbox':
      return <InboxPanel config={panel.config as InboxPanelConfig} isCollapsed={isCollapsed} panelId={panel.id} />;

    default:
      return <div className="flex items-center justify-center h-full text-muted-foreground">Unknown panel type</div>;
  }
}
