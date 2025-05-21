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
      className="flex items-center px-2 py-1 sm:pr-4 cursor-pointer group/label hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
      onClick={onToggle}
    >
      <h3 className="mr-2 text-md font-semibold leading-7 tracking-tight text-primary flex items-center">{title}</h3>
      {button}
      <ChevronRight
        className="ml-auto transition-transform"
        style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
      />
    </div>
  );
};

export default SidebarCollapsibleHeader;
