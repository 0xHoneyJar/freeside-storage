/**
 * Typed error channel for @freeside-storage/client.
 *
 * Each builder/fetcher signature names exactly which errors it can produce.
 * Consumers `Effect.catchTag("NotFoundError", ...)` to handle each case.
 * Compare to bare promises where errors are `unknown`.
 */

import { Data } from "effect";

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly collection: string;
  readonly tokenId: number;
}> {}

export class MalformedURLError extends Data.TaggedError("MalformedURLError")<{
  readonly raw: string;
  readonly reason: string;
}> {}

export class VersionDriftError extends Data.TaggedError("VersionDriftError")<{
  readonly expected: string;
  readonly got: string;
}> {}

export class MissingHashError extends Data.TaggedError("MissingHashError")<{
  readonly tokenId: number;
  readonly source: string;
}> {}

export class NotGrailError extends Data.TaggedError("NotGrailError")<{
  readonly tokenId: number;
}> {}

export type AssetError =
  | NotFoundError
  | MalformedURLError
  | VersionDriftError
  | MissingHashError
  | NotGrailError;
