import React from 'react'
import { createBrowserRouter } from 'react-router-dom';
import Home from '@/pages/Home';
import Feed from '@/pages/Feed';
import Settings from '@/pages/Settings';
import Accounts from './pages/Accounts';
import CommandPalette from '@/common/components/CommandPalette';
import LoginModal from '@/common/components/LoginModal';
import ErrorPage from '@/pages/ErrorPage';


export const router = createBrowserRouter([
  {
    path: "/",
    element: <>
      <LoginModal />
      <CommandPalette />
      <Home />
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
