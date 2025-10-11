import {
  NotifyPlayerChainedRequestInput,
} from 'bartholdi-api-typescript-runtime';
import {
  notifyPlayer,
} from '../src/notify-player';

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {} as any,
  context: {} as any,
  interceptorContext: {
    logger: {
      info: jest.fn(),
      error: jest.fn(),
    },
  },
} satisfies Omit<NotifyPlayerChainedRequestInput, 'input'>;

describe('NotifyPlayer', () => {

  it('should return not implemented error', async () => {
    // TODO: Update the test as appropriate when you implement your handler
    const response = await notifyPlayer({
      ...requestArguments,
      input: {
        // TODO: remove the "as any" below and fill in test values for the requestParameters and body
        requestParameters: {} as any,
        body: {} as any,
      },
    });

    expect(response.statusCode).toBe(500);
  });

});

