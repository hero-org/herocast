import { extendTheme } from "@chakra-ui/react";
import {
  Modal,
  Button,
  MenuTheme,
  Input,
  Tabs,
} from "@/config/theme/components";
import { colors, fonts, layerStyles } from "@/config/theme/foundation";

const borderRadius = {
  radii: {
    none: '0',
    sm: '0.125rem',
    base: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    '3xl': '1.5rem',
    full: '9999px',
  },
}

const Theme = extendTheme({
  ...borderRadius,

  fonts,
  colors,
  components: {
    Modal,
    Button,
    Input,
    Menu: MenuTheme,
    Tabs,
  },
  breakpoints: {
    sm: '30em',
    md: '46em',
    lg: '62em',
    xl: '80em',
    '2xl': '96em',
  },
  styles: {
    global: {
      "*": {
        userSelect: "none",
        boxSizing: "border-box",
        transition: "all 0.25s ease-out" // Global transition
      },
      "html, body, #root": {
        background: 'radial-gradient(ellipse at bottom, #0d1d31 0%, #0c0d13 100%)',
        width: "100%",
        height: "100%",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      },
      "body": {
        position: "fixed",
        height: "100vh",
        width: "100vw",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: "hidden",
      }
    },
  },
  layerStyles,
  shadows: {
    inset: "inset 2px 4px 8px rgba(0, 0, 0, 0.4)",
    outline: "0 !important",
    brand: {
      shadow: {
        md: "4px 5px 24px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  config: {
    initialColorMode: "dark",
    useSystemColorMode: false,
    cssVarPrefix: "tauriboilerplate",
  },
});

export default Theme;
