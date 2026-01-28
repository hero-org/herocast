// Minimal faker stub - returns safe dummy values to satisfy @farcaster/core
// Factory definitions without bundling the full 7.9MB faker library.
//
// @farcaster/core includes faker for its Factory test utilities.
// herocast only uses types, signers, validators, and message builders,
// but the Factory module is still evaluated during build, requiring these stubs.

export const faker = {
  datatype: {
    number: (opts?: { min?: number; max?: number }) => opts?.min ?? 0,
    datetime: (opts?: { min?: number; max?: number }) => new Date(opts?.min ?? Date.now()),
  },
  helpers: {
    arrayElement: <T>(arr: T[]): T => arr[0],
  },
  random: {
    alphaNumeric: (count?: number) => 'a'.repeat(count ?? 1),
  },
  string: {
    alphanumeric: (count?: number) => 'a'.repeat(count ?? 1),
  },
  internet: {
    url: () => 'https://example.com',
  },
  lorem: {
    sentence: (wordCount?: number) => 'Lorem ipsum dolor sit amet.',
  },
  date: {
    between: (from: Date | string | number, to: Date | string | number) => new Date(),
  },
};
