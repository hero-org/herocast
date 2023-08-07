import { Text, Button, Box, SimpleGrid } from '@chakra-ui/react'
import React, { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { IoLogInOutline } from 'react-icons/io5'
import { BsWindow } from 'react-icons/bs';
import { appWindow } from "@tauri-apps/api/window";
import { BoxAction, BoxFieldset, ButtonWithIcon } from '@/pages/TauriPage/components';

import {
  VscChromeClose,
  VscChromeMinimize,
  VscChromeMaximize,
  VscChromeRestore,
} from "react-icons/vsc";

interface CustomResponse {
  message: string
}

const ZustandPage: React.FC = () => {

  const [rustMsg, setRustMessage] = useState<string>('N/A')
  const [isMaxsize, setIsMaxsize] = useState<boolean>(false);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaxsize);
  }, []);

  const callTauriBackend = async () => {
    const res: CustomResponse = await invoke('message_from_rust');
    if (res !== undefined) {
      setRustMessage(res.message)
    }
  }

  const handleMaximization = async () => {
    await appWindow.toggleMaximize()
    const isMaximized = await appWindow.isMaximized();
    setIsMaxsize(isMaximized);
  }

return (
  <SimpleGrid columns={2} spacing={5}>
    <BoxAction title="Message to backend" icon={IoLogInOutline}>
      <Text>Hello World from Tauri Typescript React!</Text>

      <BoxFieldset label="Action">
        <Button onClick={callTauriBackend} width="100%">Get message from rust backend</Button>
      </BoxFieldset>
      <BoxFieldset label="Response">
        {rustMsg && (
          <h2>{rustMsg}</h2>
        )}
      </BoxFieldset>

    </BoxAction>

    <BoxAction title="Window Actions" icon={BsWindow}>
      <Text>Hello World from Tauri Typescript React!</Text>

      <BoxFieldset label="Action" display="flex" gap={2} >
        <ButtonWithIcon
          label="Close" icon={VscChromeClose}
          onClick={() => appWindow.close()} />
        <ButtonWithIcon
          label={isMaxsize ? "Restore" : "Maximize"}
          icon={isMaxsize ? VscChromeRestore : VscChromeMaximize}
          onClick={handleMaximization}
        />
        <ButtonWithIcon
          label="Minimize" icon={VscChromeMinimize}
          onClick={() => appWindow.minimize()}
        />
      </BoxFieldset>
      <BoxFieldset label="Extras" display="flex" gap={2}>
        <Box
          width="80px" height="50px"
          backgroundColor="primary.500"
          display="flex"
          borderRadius="base"
          data-tauri-drag-region
        >
          <Text fontSize="12px" textAlign="center" m="auto" data-tauri-drag-region>Drag here</Text>
        </Box>
      </BoxFieldset>

    </BoxAction>
  </SimpleGrid>
)
}

export default ZustandPage;
