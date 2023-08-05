import React from "react";
import Home from "@src/components/Home";
import CommandPalette from "@src/components/CommandPalette";
import { useAtom } from "jotai";
import { MAIN_NAVIGATION_ATOM_KEY, atomWithLocalStorage, mainNavigationAtom } from "@src/state";


const HomePage = () => {
  const [mainNavigation,] = useAtom(mainNavigationAtom)

  return <>
    <CommandPalette />
    <Home mainNavigation={mainNavigation} />
  </>;
};

export default HomePage;
