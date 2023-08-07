import React from 'react';
import { Image, Box, Text, VStack, Flex, FlexProps } from '@chakra-ui/react';

export type TechProps = FlexProps & {
  label: string;
  image: string;
}

export const Technology = (props: TechProps) => {

  const { label, image, ...restProps } = props;
  return (
    <Flex
      gap={2}
      flexDirection="column" alignItems="center" width="15%" {...restProps}
      role="group"
    >
      <VStack gap={1}>
        <Box style={{
          width: "clamp(50px, 50px, 50px)",
          height: "clamp(50px, 50px, 50px)",
        }}>
          <Image
            src={`./src/assets/images/${image}`}
            height="100%" width="100%"
            objectFit="contain"
            transition="all .2s"
            _groupHover={{
              transform: 'translateY(-20%)'
            }} />
        </Box>
        <Text fontSize="14px" fontWeight="semibold" textAlign="center" whiteSpace="nowrap">{label}</Text>
      </VStack>
    </Flex>
  );
};
