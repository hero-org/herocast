import { Button, Box, Icon, ButtonProps } from '@chakra-ui/react';
import React from 'react';
import { IconType } from 'react-icons';

type ButtonWithIconProps = ButtonProps & {
  icon: IconType;
  label: string;
}

export const ButtonWithIcon = (props: ButtonWithIconProps) => {

  const { icon, label, ...restProps } = props;
  return (
    <Button {...restProps} py={1} px={2}>
      <Box w="24px" h="24px"
        backgroundColor="primary.600"
        borderRadius="base" display="flex"
        justifyContent="center"
        alignItems="center" opacity={0.7} mr={1}
      >
        <Icon as={icon} />
      </Box>
      {label}
    </Button>
  );
};
