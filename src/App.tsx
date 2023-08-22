import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import '@/config/theme/globals.css';
import '@radix-ui/themes/styles.css';
import { router } from "@/router";
import { disableContextMenu } from '@/common/helpers/tauri/contextMenu';

disableContextMenu();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);

root.render(
  <RouterProvider router={router} />
);
