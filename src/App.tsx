import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import '@/config/theme/globals.css';
import { router } from "@/router";
// import { ChakraProvider } from '@chakra-ui/react'
// import FXDTheme from '@/config/theme/theme';
import { disableContextMenu } from '@/common/helpers/tauri/contextMenu';

disableContextMenu();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');
const root = createRoot(rootElement);

root.render(
  // <ChakraProvider resetCSS theme={FXDTheme}>
    <RouterProvider router={router} />
  // </ChakraProvider>
);
