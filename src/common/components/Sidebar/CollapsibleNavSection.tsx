import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

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
        {isSelected && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
        )}
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
          {shortcut && (
            <kbd
              className={cn(
                'px-1 py-0.5 rounded text-[10px] font-mono transition-opacity whitespace-nowrap',
                isSelected
                  ? 'opacity-70 bg-primary/20 text-primary'
                  : 'opacity-0 group-hover:opacity-60 bg-muted text-muted-foreground'
              )}
            >
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={!isCollapsed} onOpenChange={() => onToggle()}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-x-2 px-3 py-1.5 text-xs font-semibold text-foreground/60 uppercase tracking-wider hover:text-foreground/80 transition-colors">
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
