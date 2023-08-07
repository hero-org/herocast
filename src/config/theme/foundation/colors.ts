import { DeepPartial, Theme } from "@chakra-ui/react";

type TColors = {
  [key: number]: string
}

const extendedColors: DeepPartial<Record<string, TColors>> = {
  neutrals: {
    50: "#ecf2ff",
    100: "#d2d8e2",
    200: "#b6bfc9",
    300: "#9ba5b0",
    400: "#808b99",
    500: "#66727f",
    600: "#4f5864",
    700: "#373f49",
    800: "#1e262e",
    900: "#000f16",
    1000: "#181a1f"
  },
  primary: {
    50: "#ffe8ec",
    100: "#f3c1c9",
    200: "#e599a6",
    300: "#da7182",
    400: "#cf4a5f",
    500: "#b53146",
    600: "#8e2535",
    700: "#661a26",
    800: "#3e0d17",
    900: "#1a0207",
  },
  secondary: {
    50: "#e8f1ff",
    100: "#c3d6ef",
    200: "#9cbbe1",
    300: "#76a0d6",
    400: "#5185ca",
    500: "#386bb0",
    600: "#2b538a",
    700: "#1f3c63",
    800: "#10243c",
    900: "#010c18",
  },
  success: {


    50: "#defff0",
    100: "#b6f6d9",
    200: "#8df0c2",
    300: "#61e8aa",
    400: "#37e293",
    500: "#1dc879",
    600: "#129c5d",
    700: "#066f42",
    800: "#004426",
    900: "#001808",
  },
  warning:
  {
    50: "#fff8de",
    100: "#f9e9b6",
    200: "#f3db8a",
    300: "#eecc5d",
    400: "#eabe31",
    500: "#d0a418",
    600: "#a28011",
    700: "#745b09",
    800: "#453702",
    900: "#1a1200",
  },
  error:
  {
    50: "#ffe3e3",
    100: "#ffb3b3",
    200: "#fd8181",
    300: "#fc504f",
    400: "#fc241e",
    500: "#e31205",
    600: "#b10a03",
    700: "#7f0402",
    800: "#4d0000",
    900: "#1e0000",
  },
  shades: {
    0: "#FFFFFF",
    1000: "#000000",
  },
}


const overridenChakraColors: DeepPartial<Theme["colors"]> = {};

const colors = {
  ...overridenChakraColors,
  ...extendedColors,
};

export default colors;
