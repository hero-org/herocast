import { menuAnatomy } from "@chakra-ui/anatomy";
import { createMultiStyleConfigHelpers, theme } from "@chakra-ui/react";

const { definePartsStyle, defineMultiStyleConfig } =
  createMultiStyleConfigHelpers(menuAnatomy.keys)

const baseStyle = definePartsStyle({
  list: {
    ...theme?.components?.Menu?.variants?.enclosed,
    zIndex: 20,
    borderRadius: "4px",
    bg: 'neutrals.900',
    borderColor: 'neutrals.1000'
  },
  item: {
    bg: 'neutrals.900',
    _hover: {
      bg: 'neutrals.1000'
    }
  }
})

export const MenuTheme = defineMultiStyleConfig({ baseStyle });
