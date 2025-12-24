import {
  sayHelloHandler,
  SayHelloChainedHandlerFunction,
  INTERCEPTORS,
  Response,
  LoggingInterceptor,
} from 'gallaudet-api-typescript-runtime';

/**
 * Type-safe handler for the SayHello operation
 */
export const sayHello: SayHelloChainedHandlerFunction = async (request) => {
  LoggingInterceptor.getLogger(request).info('Start SayHello Operation');

  // TODO: Implement SayHello Operation. `input` contains the request input.
  const { input } = request;

  return Response.internalFailure({
    message: 'Not Implemented!',
  });
};

/**
 * Entry point for the AWS Lambda handler for the SayHello operation.
 * The sayHelloHandler method wraps the type-safe handler and manages marshalling inputs and outputs
 */
export const handler = sayHelloHandler(...INTERCEPTORS, sayHello);
