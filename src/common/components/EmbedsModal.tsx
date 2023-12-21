import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { CastType } from '../constants/farcaster';
import { SelectableListWithHotkeys } from './SelectableListWithHotkeys';
import { openWindow } from '../helpers/navigation';
import { classNames } from '../helpers/css';
import { getUrlsInText } from '../helpers/text';
import uniqBy from 'lodash.uniqby';
import OpenGraphImage from './Embeds/OpenGraphImage';

type EmbedsModalProps = {
  cast: CastType;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const EmbedsModal = ({ cast, open, setOpen }: EmbedsModalProps) => {
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (!open) {
      setSelectedIdx(0);
    }
  }, [open]);

  const renderEmbedRow = (item: any, idx: number) => {
    return (
      <li key={item?.url}
        className="flex flex-col border-b border-gray-700/40 relative max-w-full md:max-w-2xl xl:max-w-3xl">
        <OpenGraphImage url={item?.url} />
        <span
          onClick={() => onSelect(idx)}
          className={classNames(
            idx === selectedIdx ? "bg-gray-500 text-gray-300" : "text-gray-400",
            "cursor-pointer flex text-sm hover:text-gray-300 hover:bg-gray-500 py-1 px-1.5"
          )}>
          {item.url}
        </span>
      </li>
    )
  }

  const urls = uniqBy(cast?.embeds.concat(getUrlsInText(cast.text)), 'url');

  const onSelect = (idx: number) => {
    openWindow(urls[idx].url);
  }

  return (
    <Modal
      title={`Links in cast by ${cast?.author.display_name}`}
      open={open}
      setOpen={setOpen}
    >
      <div className="my-4">
        <SelectableListWithHotkeys
          data={urls}
          renderRow={renderEmbedRow}
          selectedIdx={selectedIdx}
          setSelectedIdx={setSelectedIdx}
          onSelect={onSelect}
          isActive={open}
        />
      </div>
      <span className="ml-1 text-sm text-gray-500">Use J and K no navigate down and up. Enter to open.</span>
    </Modal>
  )
};

export default EmbedsModal;
