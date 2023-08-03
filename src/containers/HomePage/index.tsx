import React from "react";
import Home from "@src/components/Home";
import CommandPalette from "@src/components/CommandPalette";
import { useState } from 'react'

const HomePage = () => {
  const [open, setOpen] = useState(false)

  return <>
    <CommandPalette open={open} setOpen={setOpen} />
    <Home />
  </>;
};

export default HomePage;
