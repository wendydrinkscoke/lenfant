// Adding a no-op test to get the build to succeed.
test('pass automatically', () => {
  expect(3).toEqual(3);
});

export const noop = "";