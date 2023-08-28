import {
  PencilIcon,
} from '@heroicons/react/20/solid'
import { classNames } from '@/common/helpers/css'
import { useEffect, useState } from 'react'
import { getNeynarCastThreadEndpoint, getNeynarNotificationsEndpoint } from '@/common/helpers/neynar'
import { useAccountStore } from '@/stores/useAccountStore'

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

enum NotificationTypeEnum {
  "cast-reply" = "cast-reply",
  "cast-mention" = "cast-mention",
}

type Notification = {
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
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const currentAccountFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);
  // group notifications by threadHash or parentHash
  //

  useEffect(() => {
    const loadData = async () => {
      const neynarEndpoint = getNeynarNotificationsEndpoint({ fid: currentAccountFid });
      await fetch(neynarEndpoint)
        .then((response) => response.json())
        .then((resp) => {
          console.log(resp.result.notifications)
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
          <span className="hidden sm:block">
            <button
              type="button"
              className="inline-flex items-center rounded-sm bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              <PencilIcon className="-ml-0.5 mr-1.5 h-5 w-5 text-gray-400" aria-hidden="true" />
              Edit
            </button>
          </span>
        </div>
      </nav>
    </>
  )

  const renderLeftColumn = () => {
    return <div className="hidden w-44 shrink-0 lg:block">
      <div className="overflow-hidden rounded-sm border border-gray-300 bg-white">
        <ul role="list" className="divide-y divide-gray-300">
          {notifications.map((n) => (
            <li key={n.hash} className="px-6 py-4">
              {/* Your content */}
              {n.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  }
  return <div className="flex min-h-screen min-w-full flex-col">
    {renderHeader()}
    {isLoading && <div className="text-white flex-1 flex items-center justify-center">
      <div className="loader">Loading...</div>
    </div>
    }
    {navigation === NotificationNavigationEnum.mentions ? (
      <div className="mx-auto flex w-full max-w-7xl items-start gap-x-8 py-10">
        {renderLeftColumn()}
        <main className="flex-1 bg-gray-400 ">
          {/* Main area */}
          main
          {renderLeftColumn()}
        </main>
      </div>
    ) : <div className="text-white flex-1 flex items-center justify-center">
      <div className="loader">Coming soon...</div>
    </div>}
  </div>
}
