import React from 'react'
import { Box, Heading, Flex } from '@chakra-ui/react'
import { Technology, TechStack } from '@/pages/WelcomePage/components';

const WelcomePage: React.FC = () => {

  return (
    <Flex justifyContent="center" flexDirection="column" h="100%">
      <Box as="section" whiteSpace="nowrap" textAlign="center">
        <Heading size="2xl">Welcome to</Heading>
        <Heading size="lg" color="orange.300">Tauri Meteor Template</Heading>
      </Box>
      <Box display="flex" flexDirection="column" gap={6}>
        <TechStack label="Core">
          <Technology label="Tauri" image="technologies/tauri.svg" />
          <Technology label="Typescript" image="technologies/typescript.svg" />
          <Technology label="ViteJS" image="technologies/vitejs.svg" />
          <Technology label="ReactJS" image="technologies/react.svg" />
        </TechStack>

        <TechStack label="Utils">
          <Technology label="Zustand" image="technologies/zustand.png" />
        </TechStack>

        <TechStack label="CSS">
          <Technology label="Chakra UI" image="technologies/chakra-ui.svg" />
        </TechStack>

      </Box>
    </Flex>

  )
}

export default WelcomePage;
