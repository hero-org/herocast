import { PACKAGE_VERSION } from '@/common/constants/tauri';
import { Box } from '@chakra-ui/react'
import React from 'react'
import { useOutlet } from 'react-router-dom';
import Sidebar from '../Sidebar'

type Props = {
  children?: React.ReactNode;
}

const AppVersion = () => (
  <Box
    position="absolute"
    bottom={2} left={2}>
    Version: {PACKAGE_VERSION}
  </Box>
)

const SidebarLayout = (props: Props) => {

  const outlet = useOutlet();

  return (
    <Sidebar>
      <AppVersion />
      <Box
        flexDirection="column"
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        {outlet}
      </Box>
    </Sidebar>
  )
}

export default SidebarLayout
