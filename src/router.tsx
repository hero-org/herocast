import React from 'react'
import { Navigate, createBrowserRouter } from 'react-router-dom';
import Home from '@/pages/Home';
import Feed from '@/pages/Feed';
import Settings from '@/pages/Settings';
import Accounts from './pages/Accounts';
import CommandPalette from '@/common/components/CommandPalette';
import ErrorPage from '@/pages/ErrorPage';
import Login from '@/pages/Login';
import { Theme } from '@radix-ui/themes';


export const router = createBrowserRouter([
  {
    path: "/",
    element: <>
      <Theme radius="small" appearance="dark">
        <CommandPalette />
        <Home />
      </Theme>
    </>,
    errorElement: <ErrorPage />,
    children: [
      {
        path: "feed",
        element: <Feed />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "accounts",
        element: <Accounts />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
      {
        path: "error",
        element: <ErrorPage />,
      },
      {
        path: "/",
        element: <Navigate to="feed" replace />
      },
    ]
  }
]);
