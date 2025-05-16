import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { PanelRightIcon } from 'lucide-react';

const RightSidebarTrigger = () => {
  return (
    <SidebarTrigger className="lg:hidden">
      <PanelRightIcon className="h-5 w-5" />
      <span className="sr-only">Toggle right sidebar</span>
    </SidebarTrigger>
  );
};

export default RightSidebarTrigger;
