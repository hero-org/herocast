import React from 'react';
import { Box, Heading, Flex, Divider, FlexProps } from '@chakra-ui/react';

export type TechStackProps = FlexProps & {
  label: string;
  children: React.ReactNode;
}

export const TechStack = (props: TechStackProps) => {

  const { label, children } = props;
  return (
    <Flex as="section" flexDirection="column" gap={4}>

      <Box display="flex" gap={3} flexDirection="column">
        <Heading size="sm">{label}</Heading>
        <Divider size="lg" w="500px" />
      </Box>
      <Flex flexDirection="row" gap={0}>
        {children}
      </Flex>
    </Flex>
  );
};
