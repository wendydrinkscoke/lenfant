import { AWSError } from 'aws-sdk';
import { GaxiosError } from 'gaxios';

export const isGaxiosError = (e: unknown): e is GaxiosError =>
  e instanceof GaxiosError;

export const isAWSError = (e: unknown): e is AWSError =>
  e instanceof Error && (e as AWSError).code !== undefined;