import { ChakraTheme, DeepPartial } from "@chakra-ui/react";

const Modal: DeepPartial<ChakraTheme["components"]["Modal"]> = {
  baseStyle: {

    dialog: {
      background: "neutrals.1000",
      paddingY: 26,
      borderRadius: 7,
      border: "2px",
      borderColor: 'neutrals.900',
      position: "relative",
      opacity: 0.98,
      mx: "auto"
    },
  }
};

export default Modal;
