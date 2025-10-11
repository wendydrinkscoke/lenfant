process.env.USER_POOL_ID = 'us-east-1_example';
process.env.ROBLOX_PROVIDER_NAME = 'RobloxOIDC';

import {
  BadRequestErrorResponseContent,
  LinkRobloxAccountChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import {
  linkRobloxAccount,
} from '../src/link-roblox-account';

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {} as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
  },
} satisfies Omit<LinkRobloxAccountChainedRequestInput, 'input'>;

describe('LinkRobloxAccount', () => {

  it('returns a validation error when robloxIdToken is missing', async () => {
    const response = await linkRobloxAccount({
      ...requestArguments,
      input: {
        requestParameters: {} as any,
        body: {} as any,
      },
    });

    expect(response.statusCode).toBe(400);
    expect((response.body as BadRequestErrorResponseContent).message).toEqual('robloxIdToken is required');
  });

});
