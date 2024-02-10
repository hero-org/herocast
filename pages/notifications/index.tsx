import React, { useEffect, useState } from 'react'

import { castTextStyle, classNames } from '../../src/common/helpers/css'
import { useAccountStore } from '../../src/stores/useAccountStore'
import { SelectableListWithHotkeys } from '../../src/common/components/SelectableListWithHotkeys'
import { localize, timeDiff } from '../../src/common/helpers/date'
import { CastThreadView } from '../../src/common/components/CastThreadView'
import isEmpty from 'lodash.isempty'
import { useHotkeys } from 'react-hotkeys-hook'
import { Key } from 'ts-key-enum'
import { CastType } from '../../src/common/constants/farcaster'
import ReplyModal from '../../src/common/components/ReplyModal'
import { NeynarAPIClient } from '@neynar/nodejs-sdk'
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v1'

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
  const [notifications, setNotifications] = useState<CastWithInteractions[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedNotificationIdx, setSelectedNotificationIdx] = useState<number>(0);
  const [isLeftColumnSelected, setIsLeftColumnSelected] = useState<boolean>(true);
  const [selectedParentCast, setSelectedParentCast] = useState<CastType | null>(null);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedCast, setSelectedCast] = useState<CastType | null>(null);

  const viewerFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);
  const now = new Date();

  useEffect(() => {
    if (!viewerFid) return;

    const loadData = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

      const resp = await neynarClient.fetchMentionAndReplyNotifications(Number(viewerFid), {
        viewerFid: Number(viewerFid),
        limit: 15
      })
      if (resp.result.notifications) {
        setNotifications(resp.result.notifications);
      }
      setIsLoading(false)
    }

    loadData();

    setShowReplyModal(false);
    setIsLeftColumnSelected(true);
    setSelectedNotificationIdx(0);
  }, [viewerFid])

  const navigationItems = [
    { name: 'Mentions & Replies', onClick: () => setNavigation(NotificationNavigationEnum.mentions), current: navigation == NotificationNavigationEnum.mentions },
    { name: 'Reactions', onClick: () => setNavigation(NotificationNavigationEnum.reactions), current: navigation == NotificationNavigationEnum.reactions },
  ]

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
          idx === selectedNotificationIdx ? 'bg-muted' : 'cursor-pointer bg-background/80',
          "flex gap-x-4 px-5 py-4 rounded-sm"
        )}>
        <img
          className="mt-1.5 rounded-lg h-10 w-10 flex-none bg-background" src={item.author.pfp.url} alt=""
        />

        <div className="flex-auto">
          <div className="flex items-center justify-between gap-x-4">
            <p className="text-sm font-semibold leading-6 text-foreground/80">{item.author.username}
              <span className="ml-1 text-foreground/70">
                {item.type === NotificationTypeEnum['cast-reply'] ? 'replied' : 'mentioned you'}
              </span>
            </p>
            <p className="flex-none text-xs text-foreground/70">
              <time dateTime={item.timestamp}>{timeAgoStr}</time>
            </p>
          </div>
          <p className="mt-1 line-clamp-3 text-sm text-foreground/80 break-words lg:break-normal" style={castTextStyle}>
            {item.text}
          </p>
        </div>
      </li>
    )
  }

  const renderLeftColumn = () => {
    return <div className="block w-full md:w-4/12 lg:6/12 shrink-0">
      <div className={classNames(
        "overflow-hidden rounded-sm border bg-background",
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
          fid={viewerFid}
          isActive={!isLeftColumnSelected}
          setSelectedCast={setSelectedCast}
          setShowReplyModal={setShowReplyModal}
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
    {isLoading && <div className="text-foreground flex-1 flex items-center justify-center">
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
    ) : <div className="text-foreground flex-1 flex items-center justify-center">
      <div className="loader">Coming soon...</div>
    </div>}
    {renderReplyModal()}
  </div>
}


export default Notifications;