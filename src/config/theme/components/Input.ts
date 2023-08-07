import { ChakraTheme, DeepPartial, theme } from "@chakra-ui/react";

const Input: DeepPartial<ChakraTheme["components"]["Input"]> = {
  baseStyle: {
    field: {

    }
  },
  variants: {
    outline: (props) => ({
      ...theme?.components?.Input?.variants?.outline(props),
      field: {
        _focusVisible: {
          boxShadow: "0 0 2px 2px #23272E",
          borderColor: "neutrals.800",
        }
      }
    })
  }
};

export default Input;
