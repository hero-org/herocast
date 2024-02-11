import * as React from 'react';
import * as Toast from '@radix-ui/react-toast';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

type ToastProps = {
  title: string;
  showToast: boolean;
  setShowToast: (showToast: boolean) => void;
  description?: string;
  actionText?: string;
}

const CustomToast = ({ title, description, showToast, setShowToast }: ToastProps) => {
  const timerRef = React.useRef(0);

  React.useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  React.useEffect(() => {
    if (showToast) {
      timerRef.current = window.setTimeout(() => {
        setShowToast(false);
      }, 4000);
    }
  }, [showToast, setShowToast]
  )

  return (
    <Toast.Root
      className="bg-background rounded-md shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] p-[15px] grid [grid-template-areas:_'title_action'_'description_action'] grid-cols-[auto_max-content] gap-x-[10px] items-center data-[state=open]:animate-slideIn data-[state=closed]:animate-hide data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out] data-[swipe=end]:animate-swipeOut"
      open={showToast}
      onOpenChange={setShowToast}
    >
      <Toast.Title className="flex [grid-area:_title] font-medium text-foreground text-[15px]">
        <div className="flex-shrink-0 mr-2">
          <CheckCircleIcon className="h-6 w-6 text-green-400" aria-hidden="true" />
        </div>
        {title}
      </Toast.Title>
      {description && (
        <Toast.Description asChild>
          <div className="[grid-area:_description] mt-[5px]  text-foreground/80 text-[13px] leading-[1.3] truncate">
            {description}
          </div>
        </Toast.Description>
      )}
    </Toast.Root>
  );
};

export default CustomToast;
