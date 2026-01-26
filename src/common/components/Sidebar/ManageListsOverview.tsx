import {
  BellIcon,
  Cog6ToothIcon,
  EllipsisVerticalIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import sortBy from 'lodash.sortby';
import { useRouter } from 'next/navigation';
import { isSearchListContent } from '@/common/types/list.types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getPlanLimitsForPlan } from '@/config/planLimits';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import UpgradeFreePlanCard from '../UpgradeFreePlanCard';
import { SidebarHeader } from './SidebarHeader';

type ListsOverviewProps = {
  hideHeader?: boolean;
  collapsible?: boolean;
  onItemClick?: () => void;
};

const ManageListsOverview = ({ collapsible, hideHeader, onItemClick }: ListsOverviewProps) => {
  const router = useRouter();
  const { searches, selectedListId, setSelectedListId, addList, lists } = useListStore();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccountId = accounts[selectedAccountIdx]?.id;

  const onManageList = (id: string) => {
    updateSelectedList(id);
    router.push('/lists?tab=search');
    if (onItemClick) onItemClick();
  };

  const updateSelectedList = (id: string) => {
    setSelectedListId(id);
    if (onItemClick) onItemClick();
  };

  const onClickSaveLastSearch = async () => {
    const lastSearch = searches[searches.length - 1];
    if (lastSearch && selectedAccountId) {
      await addList({
        name: lastSearch.term,
        account_id: selectedAccountId,
        contents: {
          term: lastSearch.term,
        },
        idx: 0,
        type: 'search',
      });
      if (onItemClick) onItemClick();
    }
  };

  const renderList = (list: (typeof lists)[number]) => {
    const isSelected = selectedListId === list.id;
    const hasEmailEnabled = isSearchListContent(list.contents) && list.contents.enabled_daily_email;

    return (
      <li key={`list-${list.id}`} className="px-2 sm:px-3 lg:px-4">
        <div
          onClick={() => updateSelectedList(list.id)}
          className={cn(
            isSelected ? 'text-foreground font-semibold' : 'text-foreground/80 hover:text-foreground/80',
            'flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer'
          )}
        >
          <span className="flex-nowrap truncate">{list.name}</span>
          <div className="flex">
            {hasEmailEnabled && <EnvelopeIcon className="h-4 w-4 mt-1 mr-1 text-muted-foreground/50" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="rounded-lg h-6 w-5">
                  <EllipsisVerticalIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-lg">
                <DropdownMenuItem onClick={() => updateSelectedList(list.id)}>
                  <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                  Search
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onManageList(list.id)}>
                  <Cog6ToothIcon className="h-4 w-4 mr-2" />
                  Manage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </li>
    );
  };

  const renderEmptyListsCard = () => (
    <Card className="m-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center">No saved searches yet</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>Save your searches to quickly access them later</CardDescription>
      </CardContent>
      {searches.length > 0 && (
        <CardFooter>
          <Button
            size="sm"
            variant="outline"
            disabled={searches.length === 0 || !selectedAccountId}
            onClick={() => onClickSaveLastSearch()}
          >
            Save last search
          </Button>
        </CardFooter>
      )}
    </Card>
  );

  const renderLists = () => {
    const savedSearchesLimit = getPlanLimitsForPlan('openSource').maxSavedSearches;

    return (
      <div className="flex flex-col">
        {lists.length >= savedSearchesLimit && <UpgradeFreePlanCard limitKey="maxSavedSearches" />}
        <ul role="list" className="my-2">
          {sortBy(lists, (s) => s.idx).map(renderList)}
        </ul>
      </div>
    );
  };

  return (
    <div>
      {!hideHeader && (
        <SidebarHeader
          title={
            <span className="flex align-center">
              <BellIcon className="h-5 w-5 mt-1 mr-1" />
              Saved Searches
            </span>
          }
        />
      )}
      {lists.length === 0 ? renderEmptyListsCard() : renderLists()}
    </div>
  );
};

export default ManageListsOverview;
