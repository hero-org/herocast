// import React from 'react';
// import { createRoot } from 'react-dom/client';
// import { RouterProvider } from 'react-router-dom';
// import { router } from "@/router";
// import { disableContextMenu } from '@/common/helpers/tauri/contextMenu';
// import { init } from "@aptabase/web";
// import { RUNNING_IN_TAURI } from './common/constants/tauri';
// import { ThemeProvider } from './common/hooks/ThemeProvider';
// import { AptabaseProvider } from '@aptabase/react';

// import '@/globals.css';

// if (RUNNING_IN_TAURI) {
//   disableContextMenu();
// }

// // const rootElement = document.getElementById('root');
// // if (!rootElement) throw new Error('Failed to find the root element');
// // const root = createRoot(rootElement);

// // root.render(
// //   <ThemeProvider defaultTheme="dark" storageKey="herocast-ui-theme">
// //     <AptabaseProvider appKey={process.env.NEXT_PUBLIC_APTABASE_KEY}>
// //       <RouterProvider router={router} />
// //     </AptabaseProvider>
// //   </ThemeProvider>
// // );

// const App = () => (
//   <ThemeProvider defaultTheme="dark" storageKey="herocast-ui-theme">
//     <AptabaseProvider appKey={process.env.NEXT_PUBLIC_APTABASE_KEY!}>
//       <RouterProvider router={router} />
//     </AptabaseProvider>
//   </ThemeProvider>
// )

// export default App;