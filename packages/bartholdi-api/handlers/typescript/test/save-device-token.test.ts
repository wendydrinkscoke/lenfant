import {
  InternalFailureErrorResponseContent,
  SaveDeviceTokenChainedRequestInput,
} from 'bartholdi-api-typescript-runtime';
import {
  saveDeviceToken,
} from '../src/save-device-token';

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: '248394b9-8b8d-4ee6-b178-0f5485edc8b2',
        },
      },
    },
  } as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
    },
    client: {
      put: jest.fn(),
    },
  },
} satisfies Omit<SaveDeviceTokenChainedRequestInput, 'input'>;

describe('SaveDeviceToken', () => {

  it('should return server error when table name is not set', async () => {
    // TODO: Update the test as appropriate when you implement your handler
    const response = await saveDeviceToken({
      ...requestArguments,
      input: {
        // TODO: remove the "as any" below and fill in test values for the requestParameters and body
        requestParameters: {} as any,
        body: {} as any,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual('Environment Misconfiguration');
  });

});