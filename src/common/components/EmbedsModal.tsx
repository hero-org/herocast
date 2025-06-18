import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { SelectableListWithHotkeys } from './SelectableListWithHotkeys';
import { openWindow } from '../helpers/navigation';
import { getUrlsInText } from '../helpers/text';
import uniqBy from 'lodash.uniqby';
import OpenGraphImage from './Embeds/OpenGraphImage';
import { renderEmbedForUrl } from './Embeds';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { cn } from '@/lib/utils';

type EmbedsModalProps = {
  cast: CastWithInteractions;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

type EmbedObject = {
  url?: string;
  cast_id?: {
    fid: number;
    hash: string;
  };
  castId?: {
    fid: number;
    hash: string;
  };
};

const EmbedsModal = ({ cast, open, setOpen }: EmbedsModalProps) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open) {
      setSelectedIdx(0);
    }
  }, [open]);

  if (!cast) {
    return null;
  }

  const renderEmbedRow = (item: EmbedObject, idx: number) => {
    const isFullEmbed = item.cast_id || item.castId;
    const displayUrl = item.url || `Cast ${item.cast_id?.hash || item.castId?.hash}`;

    return (
      <li
        key={item?.url || item.cast_id?.hash || item.castId?.hash || idx}
        className="flex flex-col border-b border-gray-700/40 relative w-full"
      >
        <div className="flex items-center justify-center p-4 min-h-[200px] max-h-[80vh] overflow-auto">
          {isFullEmbed ? (
            <div className="w-full max-w-4xl">{renderEmbedForUrl(item)}</div>
          ) : (
            <div className="w-full max-w-2xl">
              <OpenGraphImage url={item?.url} />
            </div>
          )}
        </div>
        <span
          onClick={() => onSelect(idx)}
          className={cn(
            idx === selectedIdx ? 'bg-gray-500 text-foreground/80' : 'text-foreground/70',
            'cursor-pointer flex text-sm hover:text-foreground/80 hover:bg-gray-500 py-1 px-1.5 truncate'
          )}
        >
          {displayUrl}
        </span>
      </li>
    );
  };

  // Combine cast embeds with URLs found in text
  const textUrls = getUrlsInText(cast.text || '').map((urlObj) => ({ url: urlObj.url }));
  const allEmbeds = [...(cast?.embeds || []), ...textUrls];
  const uniqueEmbeds = uniqBy(
    allEmbeds,
    (item) => item.url || item.cast_id?.hash || item.castId?.hash
  ) as EmbedObject[];

  const onSelect = (idx: number) => {
    const embed = uniqueEmbeds[idx];
    if (embed.url) {
      openWindow(embed.url);
    }
  };

  return (
    <Modal title={`Links in cast by ${cast?.author.display_name}`} open={open} setOpen={setOpen}>
      <div className="my-4">
        <SelectableListWithHotkeys
          data={uniqueEmbeds}
          renderRow={renderEmbedRow}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          onSelect={onSelect}
          isActive={open}
        />
      </div>
      <span className="ml-1 text-sm text-foreground/80">Use J and K no navigate down and up. Enter to open.</span>
    </Modal>
  );
};

export default EmbedsModal;
