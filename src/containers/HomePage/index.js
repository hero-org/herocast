import React from "react";
import Home from "../../components/Home";
import CommandPalette from "../../components/CommandPalette";
import { useState } from 'react'
// import { useHotkeys } from 'react-hotkeys-hook'

const HomePage = () => {
  const [open, setOpen] = useState(false)
  // useHotkeys(['meta+k'], () => {
  //   console.log('hotkey called', open);
  //   setOpen(!open);
  // }, [open], {
  //   enableOnContentEditable: true,
  // })

  return <>
    <CommandPalette open={open} setOpen={setOpen} />
    <Home />
  </>;
};

export default HomePage;
