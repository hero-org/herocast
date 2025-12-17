import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { usePostHog } from 'posthog-js/react';
import { useListStore } from '@/stores/useListStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IntervalFilter } from './IntervalFilter';
import { Interval } from '../types/types';
import { Switch } from '@/components/ui/switch';
import { toastSuccessSavedSearchUpdate } from '../helpers/toast';
import { BellIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';

const intervals = [Interval.d1, Interval.d7, Interval.d14];

const ManageListModal = ({ open, onClose }) => {
  const posthog = usePostHog();

  const { updateList, removeList } = useListStore();
  const [newName, setNewName] = useState('');
  const [newSearchTerm, setNewSearchTerm] = useState('');
  const [isDailyEmailEnabled, setIsDailyEmailEnabled] = useState(false);

  const list = useListStore((state) =>
    state.selectedListId !== undefined ? state.lists.find((l) => l.id === state.selectedListId) : undefined
  );
  const canSave =
    list &&
    (newName !== list.name ||
      newSearchTerm !== list.contents?.term ||
      isDailyEmailEnabled !== list.contents?.enabled_daily_email);

  const onClickDelete = async (id: string) => {
    const result = await removeList(id);
    if (result.success) {
      posthog.capture('user_delete_list');
    } else {
      toast.error('Failed to delete search', {
        description: result.error,
        duration: 5000,
      });
    }
  };

  useEffect(() => {
    if (!list) return;

    setNewName(list?.name);
    setNewSearchTerm(list?.contents?.term);
    setIsDailyEmailEnabled(list?.contents?.enabled_daily_email);
  }, [list]);

  const onClickSave = async () => {
    if (!list || !canSave) return;

    const newContents = {
      ...list.contents,
      term: newSearchTerm,
      enabled_daily_email: isDailyEmailEnabled,
    };

    const result = await updateList({
      ...list,
      name: newName,
      contents: newContents,
    });

    if (result.success) {
      toastSuccessSavedSearchUpdate(newName);
      onClose();
      posthog.capture('user_save_list');
    } else {
      console.error('Error saving list:', result.error);
      toast.error('Failed to save search', {
        description: result.error,
        duration: 5000,
      });
    }
  };

  if (!list) return null;

  const searchIntervalKey = Object.keys(Interval).find((key) => Interval[key] === list?.contents?.filters?.interval);
  const searchInterval = searchIntervalKey ? Interval[searchIntervalKey] : undefined;

  return (
    <Modal open={open} setOpen={onClose} title="Manage Saved Search">
      <div className="flex flex-col gap-4 mt-4">
        <div>
          <Label htmlFor="list-name">Change Name</Label>
          <Input id="list-name" label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="list-search">Change search</Label>
          <Input
            id="list-search"
            label="Search"
            value={newSearchTerm}
            onChange={(e) => setNewSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <Label htmlFor="daily-email-switch" className="flex">
            <BellIcon className="h-5 w-5 mr-1" />
            Daily Email Alert
          </Label>
          <Switch
            id="daily-email-switch"
            className="mt-2"
            checked={isDailyEmailEnabled}
            onCheckedChange={() => setIsDailyEmailEnabled(!isDailyEmailEnabled)}
          />
        </div>
        <div className="flex flex-row space-x-4">
          <div className="flex flex-col">
            <Label htmlFor="search-interval">Search Interval</Label>
            <IntervalFilter defaultInterval={searchInterval} intervals={intervals} />
          </div>
        </div>
        <div className="flex justify-end gap-4">
          <Button size="sm" variant="destructive" onClick={() => onClickDelete(list.id)}>
            Delete Search
          </Button>
          <Button disabled={!canSave} size="sm" onClick={() => onClickSave()}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default ManageListModal;
