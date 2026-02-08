/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/t/**/*.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/t/fixtures/',
    '<rootDir>/t/includes/',
    '<rootDir>/t/tests/',
    '<rootDir>/t/unit.js',
  ],
  testTimeout: 20000,
  verbose: true,
};
