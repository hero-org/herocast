import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';

// Compact styling for sidebar context
const kbdClassName = 'h-4 min-w-4 text-[10px]';

// Helper to render shortcut as individual keys
export const renderShortcut = (shortcut: string, isSelected: boolean) => {
  // Defensive check - return null if shortcut is undefined or empty
  if (!shortcut) {
    return null;
  }

  const opacityClass = cn('transition-opacity', isSelected ? 'opacity-70' : 'opacity-0 group-hover:opacity-60');

  // Check if shortcut contains " + " separator (e.g., "Shift + R")
  if (shortcut.includes(' + ')) {
    const keys = shortcut.split(' + ');
    return (
      <KbdGroup className={cn('gap-1', opacityClass)}>
        {keys.map((key, index) => (
          <Kbd key={index} className={kbdClassName}>
            {key}
          </Kbd>
        ))}
      </KbdGroup>
    );
  }

  // Single key
  return (
    <Kbd className={cn(kbdClassName, opacityClass)}>
      {shortcut}
    </Kbd>
  );
};

export type NavItem = {
  id: string;
  name: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
};

type CollapsibleNavSectionProps = {
  title: string;
  icon?: React.ReactNode;
  items: NavItem[];
  isCollapsed: boolean;
  onToggle: () => void;
  shortcutPrefix?: string; // e.g., "g s" for searches
  maxCollapsedItems?: number; // default 5
  onItemClick: (item: NavItem) => void;
  selectedId?: string;
  footer?: React.ReactNode;
  emptyState?: React.ReactNode;
};

const CollapsibleNavSection: React.FC<CollapsibleNavSectionProps> = ({
  title,
  icon,
  items,
  isCollapsed,
  onToggle,
  shortcutPrefix,
  maxCollapsedItems = 5,
  onItemClick,
  selectedId,
  footer,
  emptyState,
}) => {
  const [isShowAll, setIsShowAll] = useState(false);

  const visibleItems = isShowAll ? items : items.slice(0, maxCollapsedItems);
  const hasMore = items.length > maxCollapsedItems;

  const renderItem = (item: NavItem, index: number) => {
    const isSelected = selectedId === item.id;
    const showShortcut = shortcutPrefix && index < 9;
    const shortcut = showShortcut ? `${shortcutPrefix} ${index + 1}` : item.shortcut;

    return (
      <div key={item.id} className="relative group">
        <div
          onClick={() => {
            item.onClick?.();
            onItemClick(item);
          }}
          className={cn(
            'flex items-center gap-x-2 rounded-md mx-1 px-2 py-1.5 text-sm cursor-pointer transition-colors',
            isSelected
              ? 'bg-primary/15 text-foreground font-medium'
              : 'text-foreground/70 hover:text-foreground hover:bg-muted/50'
          )}
        >
          {item.icon && <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>}
          <span className="flex-1 truncate">{item.name}</span>
          {shortcut && renderShortcut(shortcut, isSelected)}
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={() => onToggle()}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            'w-full flex items-center gap-x-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
            !isCollapsed ? 'text-foreground bg-muted/30' : 'text-foreground/60 hover:text-foreground/80'
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronDown className="h-3 w-3 flex-shrink-0" />
          )}
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{title}</span>
          {items.length > 0 && (
            <span className="ml-auto text-[10px] font-normal text-foreground/40">{items.length}</span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="py-1 space-y-0.5">
          {items.length === 0 && emptyState}
          {visibleItems.map((item, index) => renderItem(item, index))}

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsShowAll(!isShowAll);
              }}
              className="w-full h-7 text-xs text-muted-foreground hover:text-foreground justify-start px-3"
            >
              {isShowAll ? 'Show less' : `Show ${items.length - maxCollapsedItems} more`}
            </Button>
          )}

          {footer && <div className="px-1 pt-1">{footer}</div>}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CollapsibleNavSection;
