export { GET, POST } from "@frames.js/render/next";

export const config = {
  unstable_allowDynamic: [
    "/node_modules/@protobufjs/**", // use a glob to allow anything in the function-bind 3rd party module
  ],
};
