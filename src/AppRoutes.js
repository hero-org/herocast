import React from "react";
import { HashRouter, Routes, BrowserRouter, Route } from "react-router-dom";
import routes from "./constants/routes.json";
import HomePage from "./containers/HomePage";

const AppRoutes = () => {
  return (
    <HashRouter>
      <Routes>
        <Route exact path={routes.HOME} element={<HomePage />} />
      </Routes>
    </HashRouter>
  );
};

export default AppRoutes;
