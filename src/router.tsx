// import React from 'react'
// import { Navigate, createBrowserRouter } from 'react-router-dom';
// import Home from '@/pages/Home';
// import Feed from '@/pages/Feed';
// import Settings from '@/pages/Settings';
// import Accounts from '@/pages/Accounts';
// import NewPost from '@/pages/NewPost';
// import Search from '@/pages/Search';
// import CommandPalette from '@/common/components/CommandPalette';
// import ErrorPage from '@/pages/ErrorPage';
// import Login from '@/pages/Login';
// import { Notifications } from '@/pages/Notifications';
// import { Theme } from '@radix-ui/themes';
// import * as Sentry from "@sentry/react";
// import {
//   useNavigationType,
//   createRoutesFromChildren,
//   matchRoutes,
// } from "react-router-dom";
// import Channels from './pages/Channels';
// import '@rainbow-me/rainbowkit/styles.css';
// import {
//   RainbowKitProvider,
// } from '@rainbow-me/rainbowkit';
// import { WagmiConfig } from 'wagmi';
// import { wagmiConfig, chains, rainbowKitTheme } from "@/common/helpers/rainbowkit";

// const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouter(createBrowserRouter);

// export const router = [
//   {
//     path: "/",
//     element: <>
//       <Theme radius="small" appearance="dark">
//         <CommandPalette />
//         <Home />
//       </Theme>
//     </>,
//     errorElement: <ErrorPage />,
//     children: [
//       {
//         path: "feed",
//         element: <Feed />,
//       },
//       {
//         path: "login",
//         element: <Login />,
//       },
//       {
//         path: "accounts",
//         element: <WagmiConfig config={wagmiConfig}>
//           <RainbowKitProvider chains={chains} theme={rainbowKitTheme}>
//             <Accounts />
//           </RainbowKitProvider>
//         </WagmiConfig>,
//       },
//       {
//         path: "post",
//         element: <NewPost />,
//       },
//       {
//         path: "channels",
//         element: <Channels />,
//       },
//       {
//         path: "notifications",
//         element: <Notifications />,
//       },
//       {
//         path: "search",
//         element: <Search />,
//       },
//       {
//         path: "settings",
//         element: <Settings />,
//       },
//       {
//         path: "error",
//         element: <ErrorPage />,
//       },
//       {
//         path: "/",
//         element: <Navigate to="feed" replace />
//       },
//     ]
//   }
// ];
