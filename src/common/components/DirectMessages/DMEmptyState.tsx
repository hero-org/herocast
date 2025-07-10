import React from 'react';
import { MessageSquare, Users, Archive } from 'lucide-react';

export enum DMTab {
  conversations = 'conversations',
  groups = 'groups',
  archived = 'archived',
}

interface DMEmptyStateProps {
  activeTab: DMTab;
}

export const DMEmptyState: React.FC<DMEmptyStateProps> = ({ activeTab }) => {
  const getEmptyStateContent = () => {
    switch (activeTab) {
      case DMTab.conversations:
        return {
          icon: MessageSquare,
          title: 'No conversations yet',
          description: 'Start messaging to see your conversations here',
        };
      case DMTab.groups:
        return {
          icon: Users,
          title: 'No group chats',
          description: 'Join or create group chats to see them here',
        };
      case DMTab.archived:
        return {
          icon: Archive,
          title: 'No archived chats',
          description: 'Archive conversations or groups to see them here',
        };
      default:
        return {
          icon: MessageSquare,
          title: 'No messages',
          description: 'Your messages will appear here',
        };
    }
  };

  const { icon: Icon, title, description } = getEmptyStateContent();

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Icon className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-foreground/60">{description}</p>
    </div>
  );
};
