import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import AppRoutes from "@src/AppRoutes";

const rootElement = document.getElementById('root');

if (!rootElement) throw new Error('Failed to find the root element');
// const root = ReactDOM.createRoot(document.getElementById("root"));
const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
);
