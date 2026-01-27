import { PageSkeleton } from '@/common/components/PageSkeleton';

export default function InboxLoading() {
  return <PageSkeleton variant="feed" itemCount={8} />;
}
