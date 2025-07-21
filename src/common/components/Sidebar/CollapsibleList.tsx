import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type CollapsibleListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  initialVisibleCount?: number;
  isShowAll?: boolean;
  setIsShowAll?: (value: boolean) => void;
  className?: string;
  footer?: React.ReactNode;
};

function CollapsibleList<T>({
  items,
  renderItem,
  initialVisibleCount = 5,
  isShowAll: externalIsShowAll,
  setIsShowAll: externalSetIsShowAll,
  className = '',
  footer,
}: CollapsibleListProps<T>) {
  const [internalIsShowAll, setInternalIsShowAll] = useState(false);

  const isShowAll = externalIsShowAll !== undefined ? externalIsShowAll : internalIsShowAll;
  const setIsShowAll = externalSetIsShowAll || setInternalIsShowAll;

  return (
    <div className={className}>
      <Collapsible open={isShowAll} onOpenChange={setIsShowAll}>
        {items.slice(0, initialVisibleCount).map((item, index) => renderItem(item, index))}
        <CollapsibleContent>
          {items.slice(initialVisibleCount).map((item, index) => renderItem(item, index + initialVisibleCount))}
        </CollapsibleContent>
        {(items.length > initialVisibleCount || footer) && (
          <div className="px-3 pt-2 pb-1">
            <div className="flex gap-1.5">
              {items.length > initialVisibleCount && (
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {isShowAll ? 'Show less' : 'Show more'}
                  </Button>
                </CollapsibleTrigger>
              )}
              {footer}
            </div>
          </div>
        )}
      </Collapsible>
    </div>
  );
}

export default CollapsibleList;
