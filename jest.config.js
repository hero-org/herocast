/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    '.*/rainbowkit$': '<rootDir>/__mocks__/rainbowkitMock.js',
    '^@paywithglide/glide-js$': '<rootDir>/__mocks__/glideMock.js',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/supabase/functions/', // Deno-based tests, run separately
  ],
};
