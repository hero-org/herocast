import React from 'react'
import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
// import ZustandPage from '@/pages/ZustandPage';
// import SidebarLayout from '@/common/components/Common/Layouts/SidebarLayout';
// import WelcomePage from '@/pages/WelcomePage/WelcomePage';
// import TauriPage from '@/pages/TauriPage/TauriPage';
import Home from '@/pages/Home';

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route index element={<Home />} />
  )
)
