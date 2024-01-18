import React, { useEffect, useState } from 'react'

import { castTextStyle, classNames } from '../../src/common/helpers/css'
import { getNeynarNotificationsEndpoint } from '../../src/common/helpers/neynar'
import { useAccountStore } from '../../src/stores/useAccountStore'
import { SelectableListWithHotkeys } from '../../src/common/components/SelectableListWithHotkeys'
import { localize, timeDiff } from '../../src/common/helpers/date'
import { CastThreadView } from '../../src/common/components/CastThreadView'
import isEmpty from 'lodash.isempty'
import { useHotkeys } from 'react-hotkeys-hook'
import { Key } from 'ts-key-enum'
import { CastType } from '../../src/common/constants/farcaster'
import ReplyModal from '../../src/common/components/ReplyModal'

enum NotificationTypeEnum {
  "cast-reply" = "cast-reply",
  "cast-mention" = "cast-mention",
}

type NotificationType = {
  hash: string;
  threadHash: string;
  parentHash: string;
  parentUrl: string;
  parentAuthor: {
    fid: string;
  };
  author: {
    fid: string;
    username: string;
    displayName: string;
    pfp: {
      url: string;
    };
  };
  text: string;
  timestamp: string;
  embeds: [];
  type: NotificationTypeEnum;
  reactions: {
    count: number;
    fids: string[];
  };
  recasts: {
    count: number;
    fids: string[];
  };
}

enum NotificationNavigationEnum {
  mentions = "mentions",
  reactions = "reactions",
}



const Notifications = () => {
  const [navigation, setNavigation] = useState<NotificationNavigationEnum>(NotificationNavigationEnum.mentions);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedNotificationIdx, setSelectedNotificationIdx] = useState<number>(0);
  const [isLeftColumnSelected, setIsLeftColumnSelected] = useState<boolean>(true);
  const [selectedParentCast, setSelectedParentCast] = useState<CastType | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedCast, setSelectedCast] = useState<CastType | null>(null);

  const currentAccountFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);
  const now = new Date();

  useEffect(() => {
    if (!currentAccountFid) return;

    const loadData = async () => {
      const neynarEndpoint = getNeynarNotificationsEndpoint({ fid: currentAccountFid });
      await fetch(neynarEndpoint)
        .then((response) => response.json())
        .then((resp) => {
          // console.log(resp.result.notifications)
          setNotifications(resp.result.notifications);
        })
        .catch((error) => {
          console.log({ error })
        })
        .finally(() => {
          setIsLoading(false)
        })
    }

    loadData();

    setShowReplyModal(false);
    setIsLeftColumnSelected(true);
    setSelectedNotificationIdx(0);
  }, [currentAccountFid])

  const navigationItems = [
    { name: 'Mentions & Replies', onClick: () => setNavigation(NotificationNavigationEnum.mentions), current: navigation == NotificationNavigationEnum.mentions },
    { name: 'Reactions', onClick: () => setNavigation(NotificationNavigationEnum.reactions), current: navigation == NotificationNavigationEnum.reactions },
  ]

  const renderHeader = () => (
    <>
      <nav className="min-w-full flex items-center justify-between lg:space-x-8 lg:py-2" aria-label="Global">
        <div>
          {navigationItems.map((item) => (
            <div
              key={item.name}
              onClick={() => item.onClick()}
              className={classNames(
                item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                'cursor-pointer inline-flex items-center rounded-sm py-2 px-3 text-sm font-medium'
              )}
              aria-current={item.current ? 'page' : undefined}
            >
              {item.name}
            </div>
          ))}
        </div>
        <div className="mt-5 flex lg:ml-4 lg:mt-0">
          {/* <span className="hidden sm:block">
            <button
              type="button"
              className="inline-flex items-center rounded-sm bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <PencilIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
              Edit
            </button>
          </span> */}
        </div>
      </nav>
    </>
  )

  useHotkeys('r', () => {
    setShowReplyModal(true);
  }, [showReplyModal], {
    enabled: !showReplyModal,
    enableOnFormTags: false,
    preventDefault: true,
  });

  useHotkeys(['tab', 'shift+tab'], () => {
    setIsLeftColumnSelected(!isLeftColumnSelected);
  }, [isLeftColumnSelected], {
    enabled: !showReplyModal,
    preventDefault: true,
  });

  useHotkeys(['l', 'o', Key.Enter, Key.ArrowRight], () => {
    setIsLeftColumnSelected(false);
  }, [isLeftColumnSelected], {
    enabled: !showReplyModal,
    preventDefault: true,
  });

  useHotkeys(['h', Key.Escape, Key.ArrowLeft], () => {
    setIsLeftColumnSelected(true);
  }, [isLeftColumnSelected], {
    enabled: !showReplyModal,
    preventDefault: true,
  });


  const renderNotificationRow = (item: NotificationType, idx: number) => {
    const timeAgo = timeDiff(now, new Date(item.timestamp))
    const timeAgoStr = localize(timeAgo[0], timeAgo[1]);
    return (
      <li key={`notification-${item.hash}-${item.timestamp}`}
        onClick={() => setSelectedNotificationIdx(idx)}
        className={classNames(
          idx === selectedNotificationIdx ? 'bg-gray-600' : 'cursor-pointer bg-gray-800 hover:bg-gray-700',
          "flex gap-x-4 px-5 py-4 rounded-sm"
        )}>
        <img
          className="mt-1.5 rounded-lg h-10 w-10 flex-none bg-gray-50" src={item.author.pfp.url} alt=""
        />

        <div className="flex-auto">
          <div className="flex items-center justify-between gap-x-4">
            <p className="text-sm font-semibold leading-6 text-gray-100">{item.author.username}
              <span className="ml-1 text-gray-400">
                {item.type === NotificationTypeEnum['cast-reply'] ? 'replied' : 'mentioned you'}
              </span>
            </p>
            <p className="flex-none text-xs text-gray-400">
              <time dateTime={item.timestamp}>{timeAgoStr}</time>
            </p>
          </div>
          <p className="mt-1 line-clamp-3 text-sm text-gray-300 break-words lg:break-normal" style={castTextStyle}>
            {item.text}
          </p>
        </div>
      </li>
    )
  }

  const renderLeftColumn = () => {
    return <div className="block w-full md:w-4/12 lg:6/12 shrink-0">
      <div className={classNames(
        "overflow-hidden rounded-sm border bg-gray-800",
        isLeftColumnSelected ? "border-gray-400" : "border-gray-800"
      )}>
        <div className="divide-y divide-white/5">
          <SelectableListWithHotkeys
            data={notifications}
            selectedIdx={selectedNotificationIdx}
            setSelectedIdx={setSelectedNotificationIdx}
            renderRow={(item: NotificationType, idx: number) => renderNotificationRow(item, idx)}
            onSelect={(idx) => setSelectedNotificationIdx(idx)}
            onExpand={() => null}
            isActive={isLeftColumnSelected && !showReplyModal}
            disableScroll
          />
        </div>
      </div>
    </div>
  }

  const renderMainContent = () => {
    return !isEmpty(selectedParentCast) ?
      <div className="mt-2">
        <CastThreadView
          cast={{ hash: selectedParentCast.hash, author: selectedParentCast.author }}
          fid={currentAccountFid}
          isActive={!isLeftColumnSelected}
          setSelectedCast={setSelectedCast}
        />
      </div> : null;
  }

  useEffect(() => {
    if (selectedNotificationIdx !== -1) {
      const notification = notifications[selectedNotificationIdx];
      const hash = notification?.threadHash || notification?.parentHash || notification?.hash

      // getParentCast(hash)

      const author = notification?.author;
      if (!hash) return;
      
      setSelectedParentCast({ hash, author });
      setSelectedCast(notification as CastType);
    }
  }, [selectedNotificationIdx, isLoading])

  const renderReplyModal = () => (
    <ReplyModal
      open={showReplyModal}
      setOpen={() => setShowReplyModal(false)}
      parentCast={selectedCast}
    />
  );

  return <div className="flex min-h-screen min-w-full flex-col">
    {/* {renderHeader()} */}
    {isLoading && <div className="text-white flex-1 flex items-center justify-center">
      <div className="loader">Loading...</div>
    </div>
    }
    {navigation === NotificationNavigationEnum.mentions ? (
      <div className="mx-auto flex w-full max-w-7xl items-start">
        {renderLeftColumn()}
        <main className={classNames("hidden md:block flex-1 ml-4 border", !isLeftColumnSelected ? "border-gray-400" : "border-gray-800")}>
          {renderMainContent()}
        </main>
      </div>
    ) : <div className="text-white flex-1 flex items-center justify-center">
      <div className="loader">Coming soon...</div>
    </div>}
    {renderReplyModal()}
  </div>
}


export default Notifications;