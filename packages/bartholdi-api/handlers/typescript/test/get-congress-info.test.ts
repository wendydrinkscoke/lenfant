import {
  GetCongressInfoChainedRequestInput,
} from 'bartholdi-api-typescript-runtime';
import {
  getCongressInfo,
} from '../src/get-congress-info';

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {} as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
    },
  },
} satisfies Omit<GetCongressInfoChainedRequestInput, 'input'>;

describe('GetCongressInfo', () => {

  it('should return not implemented error', async () => {
    // TODO: Update the test as appropriate when you implement your handler
    const response = await getCongressInfo({
      ...requestArguments,
      input: {
        // TODO: remove the "as any" below and fill in test values for the requestParameters
        requestParameters: {} as any,
        body: {} as never,
      },
    });

    expect(response.statusCode).toBe(500);
  });

});

