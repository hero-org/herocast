import { ChevronRight } from 'lucide-react';
import type React from 'react';

type SidebarCollapsibleHeaderProps = {
  title: React.ReactNode;
  button?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
};

const SidebarCollapsibleHeader = ({ title, button, isOpen, onToggle }: SidebarCollapsibleHeaderProps) => {
  return (
    <div
      className="flex items-center justify-between cursor-pointer group/label hover:bg-sidebar/20 px-1 py-0.5 rounded transition-colors duration-150"
      onClick={onToggle}
    >
      <h3 className="text-xs font-semibold leading-5 text-foreground/70 uppercase tracking-wider">{title}</h3>
      <div className="flex items-center gap-x-1">
        {button}
        <ChevronRight
          className="h-3.5 w-3.5 text-foreground/40 transition-transform duration-150"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />
      </div>
    </div>
  );
};

export default SidebarCollapsibleHeader;
