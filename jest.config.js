/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+.tsx?$': [
      'ts-jest',
      {
        // Skip type checking during tests to match Next.js build behavior
        // Type errors should be caught by a separate type check command (e.g., tsc --noEmit)
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: {
    // Mock problematic ESM modules FIRST (before the @/ alias resolution)
    '.*/rainbowkit(\\.tsx?)?$': '<rootDir>/__mocks__/rainbowkit.js',
    // Mock Supabase client for tests
    '.*/supabase/component(\\.ts)?$': '<rootDir>/__mocks__/supabase-client.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock CSS imports
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
  },
};
