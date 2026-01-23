import React from 'react';
import { Button } from '@/components/ui/button';
import { GripVertical, ChevronLeft, X } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  icon?: React.ReactNode;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onClose: () => void;
  dragHandleProps?: any;
}

const PanelHeader: React.FC<PanelHeaderProps> = ({
  title,
  icon,
  isCollapsed,
  onToggleCollapse,
  onClose,
  dragHandleProps,
}) => {
  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-muted/50 px-2">
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse} title="Collapse panel">
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Collapse</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
          onClick={onClose}
          title="Close panel"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
    </div>
  );
};

export default PanelHeader;
