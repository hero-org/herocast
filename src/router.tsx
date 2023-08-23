import React from 'react'
import { createBrowserRouter } from 'react-router-dom';
import Home from '@/pages/Home';
import Feed from '@/pages/Feed';
import Settings from '@/pages/Settings';
import Accounts from './pages/Accounts';
import CommandPalette from '@/common/components/CommandPalette';
import LoginModal from '@/common/components/LoginModal';
import ErrorPage from '@/pages/ErrorPage';
import { Theme } from '@radix-ui/themes';


export const router = createBrowserRouter([
  {
    path: "/",
    element: <>
      <Theme radius="small" appearance="dark">
        <LoginModal />
        <CommandPalette />
        <Home />
      </Theme>
    </>,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "login",
        element: <LoginModal />,
      },
      {
        path: "feed",
        element: <Feed />,
      },
      {
        path: "accounts",
        element: <Accounts />,
      },
      {
        path: "settings",
        element: <Settings />,
        // lazy: () => import('@/pages/Settings'),
      },
    ]
  }
]);
