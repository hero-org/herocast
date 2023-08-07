import React, { ReactNode } from 'react';
import {
  Box,
  CloseButton,
  Flex,
  Icon,
  useColorModeValue,
  Drawer,
  DrawerContent,
  Text,
  useDisclosure,
  BoxProps,
  FlexProps,
  Image
} from '@chakra-ui/react';
import {
  FiHome,
  FiTrendingUp,
  FiCompass,
  FiStar,
  FiSettings,
} from 'react-icons/fi';
import { IconType } from 'react-icons';
import { SidebarLinkItems } from '@/common/constants/navigation';
import { Link } from 'react-router-dom';

interface NavItemProps extends FlexProps {
  icon: IconType;
  to?: string;
  children: React.ReactNode;
}

export default function Sidebar({ children }: { children: ReactNode }) {
  const { isOpen, onClose } = useDisclosure();
  return (
    <Box minH="100vh" height="100%">
      <SidebarContent
        onClose={() => onClose}
        display={{ base: 'none', md: 'block' }}
      />
      <Drawer
        autoFocus={false}
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full">
        <DrawerContent>
          <SidebarContent onClose={onClose} />
        </DrawerContent>
      </Drawer>
      <Box ml={{ base: 0, md: 60 }} height="100%">
        {children}
      </Box>
    </Box>
  );
}

interface SidebarProps extends BoxProps {
  onClose: () => void;
}

const SidebarContent = ({ onClose, ...rest }: SidebarProps) => {
  return (
    <Box
      borderRight="1px"
      borderRightColor="primary.700"
      w={{ base: 'full', md: 60 }}
      h="full"
      position="fixed"
      {...rest}>
      <Box
        position="absolute"
        bg="primary.700" height="100%" width="100%" blur="3xl" opacity={0.4} zIndex={-1}
        pointerEvents="none" userSelect="none" />
      <Flex h="20" alignItems="center" mx="8" gap={2}>
        <Image src="./src/assets/images/meteor.png" width="32px" />
        <Text fontSize="2xl" fontFamily="monospace" fontWeight="bold" textAlign="center" pt={2}>
          Meteor
        </Text>
        <CloseButton display={{ base: 'flex', md: 'none' }} onClick={onClose} />
      </Flex>
      {SidebarLinkItems.map((link) => (
        <NavItem key={link.name} to={link.to} icon={link.icon}>
          {link.name}
        </NavItem>
      ))}
    </Box>
  );
};

const NavItem = ({ icon, children, to, ...rest }: NavItemProps) => {
  return (
    <Link to={to || '#'} style={{ textDecoration: 'none' }}>
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        _hover={{
          bg: 'primary.700',
          color: 'white',
        }}
        _active={{
          opacity: 0.6,
          transform: 'scale(0.98)'
        }}
        transition="all 0.2s"
        {...rest}>
        {icon && (
          <Icon
            mr="4"
            _groupHover={{
              color: 'white',
            }}
            as={icon}
          />
        )}
        {children}
      </Flex>
    </Link>
  );
};
