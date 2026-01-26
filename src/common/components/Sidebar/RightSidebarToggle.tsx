import { PanelRight } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/stores/useNavigationStore';

interface RightSidebarToggleProps {
  className?: string;
}

const RightSidebarToggle: React.FC<RightSidebarToggleProps> = ({ className }) => {
  const { rightSidebarOpen, toggleRightSidebar } = useNavigationStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={toggleRightSidebar}
      title={rightSidebarOpen ? 'Hide right panel (⇧⌘B)' : 'Show right panel (⇧⌘B)'}
    >
      <PanelRight className="h-4 w-4" />
      <span className="sr-only">Toggle right sidebar</span>
    </Button>
  );
};

export default RightSidebarToggle;
