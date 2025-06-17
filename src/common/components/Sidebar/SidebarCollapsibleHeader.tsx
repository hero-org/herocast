import React from 'react';
import { ChevronRight } from 'lucide-react';
import { SidebarGroupLabel } from '@/components/ui/sidebar';
import { CollapsibleTrigger } from '@/components/ui/collapsible';

type SidebarCollapsibleHeaderProps = {
  title: React.ReactNode;
  button?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
};

const SidebarCollapsibleHeader = ({ title, button, isOpen, onToggle }: SidebarCollapsibleHeaderProps) => {
  return (
    <div
      className="flex items-center justify-between cursor-pointer group/label hover:bg-sidebar/30 rounded-lg transition-colors duration-200"
      onClick={onToggle}
    >
      <h3 className="text-sm font-semibold leading-6 text-foreground/90 flex items-center gap-x-2">{title}</h3>
      <div className="flex items-center gap-x-2">
        {button}
        <ChevronRight
          className="h-4 w-4 text-foreground/50 transition-transform duration-200 group-hover/label:text-foreground/70"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </div>
    </div>
  );
};

export default SidebarCollapsibleHeader;
