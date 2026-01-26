import { PanelLeft } from 'lucide-react';
import type React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigationStore } from '@/stores/useNavigationStore';

interface LeftSidebarToggleProps {
  className?: string;
}

const LeftSidebarToggle: React.FC<LeftSidebarToggleProps> = ({ className }) => {
  const { leftSidebarOpen, toggleLeftSidebar } = useNavigationStore();

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={toggleLeftSidebar}
      title={leftSidebarOpen ? 'Hide left panel (⌘B)' : 'Show left panel (⌘B)'}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Toggle left sidebar</span>
    </Button>
  );
};

export default LeftSidebarToggle;
