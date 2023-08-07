import { ChakraTheme, DeepPartial, StyleFunctionProps, theme } from "@chakra-ui/react";

const Tabs: DeepPartial<ChakraTheme["components"]["Tabs"]> = {
    variants: {
        board: (props: StyleFunctionProps) => ({
            ...theme?.components?.Tabs?.variants?.enclosed(props),
            tab: {
                border: '2px solid',
                borderColor: 'transparent',
                backgroundColor: "rgba(62, 71, 81, 0.2)",
                borderBottom: 'none',
                borderTopRadius: '4px',
                _selected: {
                  bg: "rgba(98, 109, 122, 0.2)",
                },
              },
            tablist: {
                ml: 3,
                borderBottom: '2x solid',
                borderColor: 'inherit',
              },
              tabpanel: {
                backgroundColor: "rgba(98, 109, 122, 0.2)",
              },
        }),
    }
};

export default Tabs;
