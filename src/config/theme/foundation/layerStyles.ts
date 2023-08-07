import { ChakraTheme, DeepPartial } from "@chakra-ui/react";

const fonts: DeepPartial<ChakraTheme["layerStyles"]> = {
    xs: {
        fontSize: "12px",
        lineHeight: "14.63px",
        fontWeight: "400"
    },
    s: {

        fontSize: "14px",
        lineHeight: "17.07px",
        fontWeight: "400"
    },
    base: {
        fontSize: "16px",
        lineHeight: "19.5px",
        fontWeight: "400",
        color: "neutrals.200"
    },
    lg: {
        fontSize: "16px",
        lineHeight: "19.5px",
        fontWeight: "600"
    },
    xl: {
        fontSize: "20px",
        lineHeight: "24.38px",
        fontWeight: "600",
        color: "neutrals.200"
    },
    "2xl": {
        fontSize: "24px",
        lineHeight: "29.26px",
        fontWeight: "600",
        color: "neutrals.200"
    },
    "2xl-mob": {
      fontSize: "24px",
      lineHeight: "29.26px",
      fontWeight: "700",
      color: "neutrals.200"
  },
    "3xl": {
        fontSize: "32px",
        lineHeight: "39.01px",
        fontWeight: "700",
        color: "neutrals.200"
    },
    "4xl": {
        fontSize: "2.5em",
        lineHeight: "48.76px",
        fontWeight: "bold"
    }
};

export default fonts;
