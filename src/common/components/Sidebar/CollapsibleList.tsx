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
};

function CollapsibleList<T>({
  items,
  renderItem,
  initialVisibleCount = 5,
  isShowAll: externalIsShowAll,
  setIsShowAll: externalSetIsShowAll,
  className = '',
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
        {items.length > initialVisibleCount && (
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-1">
              <span>Show {isShowAll ? 'less' : 'more'}</span>
            </Button>
          </CollapsibleTrigger>
        )}
      </Collapsible>
    </div>
  );
}

export default CollapsibleList;
