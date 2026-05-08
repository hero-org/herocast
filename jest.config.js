/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // Override tsconfig "jsx": "preserve" so JSX is compiled for Jest.
        // Existing helper tests don't use JSX, so this is a no-op for them.
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    ],
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
    '/__tests__/fixtures/', // shared fixture data, not test files
  ],
};
