process.env.GOOGLE_OAUTH_CLIENT_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:dummy';
process.env.OAUTH_TOKENS_TABLE_NAME = 'OAuthTokens';

import {
  InternalFailureErrorResponseContent,
  DelegateGoogleClassroomAccessChainedRequestInput,
} from 'gallaudet-api-typescript-runtime';
import {
  delegateGoogleClassroomAccess,
} from '../src/delegate-google-classroom-access';

// Common request arguments
const requestArguments = {
  chain: undefined as never,
  event: {
    requestContext: {
      authorizer: {
        claims: {
          sub: '248394b9-abcd-1234-b178-0f5485edc8b2',
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
  },
} satisfies Omit<DelegateGoogleClassroomAccessChainedRequestInput, 'input'>;

describe('DelegateGoogleClassroomAccess', () => {

  it('should fail since SecretsManager SDK was not mocked', async () => {
    // TODO: Update the test as appropriate when you implement your handler
    const response = await delegateGoogleClassroomAccess({
      ...requestArguments,
      input: {
        // TODO: remove the "as any" below and fill in test values for the requestParameters and body
        requestParameters: {} as any,
        body: {} as any,
      },
    });

    expect(response.statusCode).toBe(500);
    expect((response.body as InternalFailureErrorResponseContent).message)
      .toEqual('Failed to retrieve the Google OAuth client secret');
  });

});
