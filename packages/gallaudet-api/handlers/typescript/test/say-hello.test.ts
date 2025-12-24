import {
  InternalFailureErrorResponseContent,
  SayHelloChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import {
  sayHello,
} from '../src/say-hello';

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
} satisfies Omit<SayHelloChainedRequestInput, 'input'>;

describe('SayHello', () => {

  it('should return not implemented error', async () => {
    // TODO: Update the test as appropriate when you implement your handler
    const response = await sayHello({
      ...requestArguments,
      input: {
        // TODO: remove the "as any" below and fill in test values for the requestParameters
        requestParameters: {} as any,
        body: {} as never,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message).toEqual('Not Implemented!');
  });

});

