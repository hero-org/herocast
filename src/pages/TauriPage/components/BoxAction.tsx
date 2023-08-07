import { Text, Box, Icon } from '@chakra-ui/react';
import React from 'react';
import { IconType } from 'react-icons';

type BoxActionProps = {
  children: React.ReactNode;
  title: string;
  icon: IconType;
}

export const BoxAction = (props: BoxActionProps) => {
  const { children, title, icon } = props;
  return (
    <Box
      width="400px"
      height="auto"
      background="primary.600"
      borderRadius="md"
      padding={3}
      position="relative"
      paddingTop={7}
      role="group"
    >
      <Box as="span"
        position="absolute"
        display="flex" top={-4}
        background="primary.500"
        p={2}
        borderRadius="base"
        _groupHover={{
          transform: "translateY(-3px)"
        }}
      >
        <Icon as={icon} mr={2} /> <Text fontSize="12px">{title}</Text>
      </Box>
      {children}
    </Box>
  );
};
