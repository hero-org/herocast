import React, { useEffect, useState } from 'react'

import { classNames } from '@/common/helpers/css'
import { fetchCasts, getNeynarNotificationsEndpoint } from '@/common/helpers/neynar'
import { useAccountStore } from '@/stores/useAccountStore'
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys'
import { localize, timeDiff } from '@/common/helpers/date'
import { CastThreadView } from '@/common/components/CastThreadView'
import isEmpty from 'lodash.isempty'
import { useHotkeys } from 'react-hotkeys-hook'
import { Key } from 'ts-key-enum'
import { CastType } from '@/common/constants/farcaster'

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



export const Notifications = () => {
  const [navigation, setNavigation] = useState<NotificationNavigationEnum>(NotificationNavigationEnum.mentions);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedNotificationIdx, setSelectedNotificationIdx] = useState<number>(0);
  const [isLeftColumnSelected, setIsLeftColumnSelected] = useState<boolean>(true);
  const [selectedParentCast, setSelectedParentCast] = useState<CastType | null>(null);

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

  useHotkeys(['tab', 'o', Key.Enter], () => {
    setIsLeftColumnSelected(false)
  }, [isLeftColumnSelected]);

  useHotkeys(['shift+tab', Key.Escape], () => {
    setIsLeftColumnSelected(true)
  }, [isLeftColumnSelected]);


  const renderNotificationRow = (item: NotificationType, idx: number) => {
    const timeAgo = timeDiff(now, new Date(item.timestamp))
    const timeAgoStr = localize(timeAgo[0], timeAgo[1]);
    return (
      <li key={`${item.hash}-${item.timestamp}`}
        onClick={() => setSelectedNotificationIdx(idx)}
        className={classNames(
          idx === selectedNotificationIdx ? 'bg-gray-600' : 'cursor-pointer bg-gray-800 hover:bg-gray-700',
          "flex gap-x-4 px-5 py-4"
        )}>
        <img className="mt-1.5 h-10 w-10 flex-none rounded-full bg-gray-50" src={item.author.pfp.url} alt="" />
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
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-400">{item.text}</p>
        </div>
      </li>
    )
  }

  const renderLeftColumn = () => {
    return <div className="block w-6/12 shrink-0">
      <div className={classNames(
        "overflow-hidden rounded-l-sm border bg-gray-800",
        isLeftColumnSelected ? "border-gray-600" : "border-gray-800"
      )}>
        <div className="divide-y divide-white/5">
          <SelectableListWithHotkeys
            data={notifications}
            selectedIdx={selectedNotificationIdx}
            setSelectedIdx={setSelectedNotificationIdx}
            renderRow={(item: NotificationType, idx: number) => renderNotificationRow(item, idx)}
            onSelect={(idx) => setSelectedNotificationIdx(idx)}
            onExpand={() => null}
          />
        </div>
      </div>
    </div>
  }

  const renderMainContent = () => {
    return !isEmpty(selectedParentCast) ?
      <CastThreadView
        cast={{ hash: selectedParentCast.hash, author: selectedParentCast.author }}
        fid={currentAccountFid}
        isActive={false}
      /> : null;
  }

  useEffect(() => {
    const getParentCast = async (hash: string) => {
      if (!hash) return;
      console.log('getParentCast', hash);
      const responseFetchCasts = await fetchCasts([{ hash }]);
      console.log('responseFetchCasts', responseFetchCasts);
      setSelectedParentCast(responseFetchCasts[0])
    }

    if (selectedNotificationIdx !== -1) {
      const notification = notifications[selectedNotificationIdx]
      const hash = notification?.threadHash || notification?.parentHash || notification?.hash

      getParentCast(hash)

      const author = notification?.author;
      console.log('setting selected parent cast', hash, author);
      if (!hash) return;
      setSelectedParentCast({ hash, author })

    }
  }, [selectedNotificationIdx])

  return <div className="flex min-h-screen min-w-full flex-col">
    {renderHeader()}
    {isLoading && <div className="text-white flex-1 flex items-center justify-center">
      <div className="loader">Loading...</div>
    </div>
    }
    {navigation === NotificationNavigationEnum.mentions ? (
      <div className="mx-auto flex w-full max-w-7xl items-start py-5">
        {renderLeftColumn()}
        <main className={classNames("hidden md:block flex-1 ml-4 border", !isLeftColumnSelected ? "border-gray-600" : "border-gray-800")}>
          {renderMainContent()}
        </main>
      </div>
    ) : <div className="text-white flex-1 flex items-center justify-center">
      <div className="loader">Coming soon...</div>
    </div>}
  </div>
}


// transform this into a type
// {
// 	result: {
// 	notifications: [
// 		{
// 			hash: "0x1661c3687633ae6104be62256d85d3a27ec1ceae",
// 			parentHash: "0xce5c6310d1164d80452fe3388d5f2b9d7eeedb20",
// 			parentUrl: "chain://eipchain://eip155:7777777/erc721:0x47163feb5c3b97f90671b1e1a1359b8240edbdbe"
// 			parentAuthor: {
// 				fid: "194"
// 			},
// 			author: {
// 				fid: "834",
// 				username: "gabrielayuso.eth",
// 				displayName: "GabrielAyuso.eth ⌐◨-◨",
// 				pfp: {
// 					url: "https://openseauserdata.com/files/b508b2a34a0295f220bffbab3d775472.svg"
// 				}
// 			},
// 			text: "Not very well.
// 				At least on Android I have to download a gif to my phone and then upload it on the app which not always works, Jam works better when uploading gifs.

// 				I'd love to be able to post gifts directly from my keyboard.",
// 			timestamp: "2023-08-05T20:25:08.907Z",
// 			embeds: [ ],
// 			type: "cast-reply",
// 			reactions: {
// 				count: 3,
// 				fids: [
// 					194,
// 					4877,
// 					7540
// 				]
// 			},
// 			recasts: {
// 				count: 0,
// 				fids: [ ]
// 			},
// 			recasters: [ ],
// 			recast: true,
// 			replies: {
// 			count: "3"
// 		}
// 		},
// 		{
// 			hash: "0xdffdb1adf3f60bcca7480e5619bfbd087cf220aa",
// 			threadHash: "0xbde39822c3474649f3583537423ebb2a6cb59cc9",
// 			parentAuthor: {
// 				fid: "373"
// 			},
// 			author: {
// 				fid: "373",
// 				username: "jayme",
// 				displayName: "Jayme ",
// 					pfp: {
// 						url: "https://lh3.googleusercontent.com/kXfYD6XCiZZz5I2lHu_00NfDS-TAzJ700i_pK7RfJiPoyR7LQLJe0S1AfHLAHUgrO4tZtDSn-XpHttdWz5YYt-Ok5E9jai6_wA6gP3Q"
// 					}
// 				},
// 				text: "Also, the weekly digest now includes
// 					- launch title + body h/t @rish
// 					- Trending apps section
// 					- Share via cast or x-ing 😅
// 					-  s@ybhoutout",
// 				timestamp: "2023-08-04T23:13:36.256Z",
// 				embeds: [
// 					{
// 						url: "https://i.imgur.com/gWjNOmc.jpg"
// 					}
// 				],
// 				type: "cast-mention",
// 				reactions: {
// 					count: 6,
// 					fids: [
// 						616,
// 						3206,
// 						3115,
// 						9391,
// 						13752,
// 						194
// 					]
// 					},
// 				recasts: {
// 					count: 2,
// 					fids: [
// 						3206,
// 						13752
// 					]
// 					},
// 				recasters: [
// 				"yb",
// 				"hosein778"
// 				],
// 				recast: true,
// 				replies: {
// 				count: "1"
// 				}
// 			},
// 		]
// 	}
// }
//
