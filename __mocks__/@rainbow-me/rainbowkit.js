module.exports = {
  getDefaultConfig: jest.fn(() => ({})),
  midnightTheme: jest.fn(() => ({})),
  RainbowKitProvider: jest.fn(({ children }) => children),
  ConnectButton: jest.fn(() => null),
};
