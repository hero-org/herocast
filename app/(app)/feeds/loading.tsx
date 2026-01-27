import { PageSkeleton } from '@/common/components/PageSkeleton';

export default function FeedsLoading() {
  return <PageSkeleton variant="feed" itemCount={10} />;
}
