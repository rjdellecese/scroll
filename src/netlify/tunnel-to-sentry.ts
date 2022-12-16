import type { Handler } from "@netlify/functions";
import type { Response as NetlifyResponse } from "@netlify/functions/dist/function/response";
import {
  either,
  json,
  readonlyNonEmptyArray,
  string,
  task,
  taskEither,
} from "fp-ts";
import type { Either } from "fp-ts/lib/Either";
import { constVoid, flow, pipe } from "fp-ts/lib/function";
import type { Json } from "fp-ts/lib/Json";
import type { TaskEither } from "fp-ts/lib/TaskEither";
import { url } from "fp-ts-std";
import type { Response as GotResponse } from "got";
import got from "got";
import { match, P } from "ts-pattern";

import * as sentryConfig from "../sentry-config";

// I used the Ruby code from https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option as a reference for the below.
const handler: Handler = async (event) =>
  pipe(
    either.Do,
    either.bind("envelope", () =>
      either.fromNullable("Request body is empty")(event.body)
    ),
    either.bind("dsn", ({ envelope }) =>
      pipe(
        envelope,
        string.split("\n"),
        (splitEnvelope): Either<string, string> =>
          match<boolean, Either<string, string>>(splitEnvelope.length === 1)
            .with(true, () => either.left("No headers in envelope"))
            .with(false, () =>
              pipe(splitEnvelope, readonlyNonEmptyArray.head, either.right)
            )
            .exhaustive(),
        either.chain(
          flow(
            json.parse,
            either.mapLeft((error) => `${error}`)
          )
        ),
        either.chain((headers) =>
          match<Json, Either<string, URL>>(headers)
            .with({ dsn: P.select("dsn", P.string) }, ({ dsn }) =>
              url.parse((error) => `${error}`)(dsn)
            )
            .otherwise(() => either.left("Couldn't find dsn header"))
        )
      )
    ),
    either.bind(
      "projectId",
      ({ dsn }): Either<string, string> =>
        pipe(dsn.pathname, string.replace("/", ""), either.right)
    ),
    either.chainFirst(({ dsn }) =>
      match(string.Eq.equals(dsn.hostname, sentryConfig.host))
        .with(true, () => either.right(null))
        .with(false, () => either.left(`Invalid hostname: ${dsn.hostname}`))
        .exhaustive()
    ),
    either.chainFirst(({ projectId }) =>
      match(string.Eq.equals(projectId, sentryConfig.projectId))
        .with(true, () => either.right(null))
        .with(false, () => either.left(`Invalid projectId: ${projectId}`))
        .exhaustive()
    ),
    taskEither.fromEither,
    taskEither.chainW(({ envelope, projectId }) =>
      pipe(
        () =>
          got(`https://sentry.io/api/${projectId}/envelope/`, {
            method: "POST",
            body: envelope,
          }),
        task.chain((response) =>
          match<
            boolean,
            TaskEither<
              {
                statusCode: GotResponse["statusCode"];
                statusMessage: GotResponse["statusMessage"];
                body: string;
              },
              void
            >
          >(response.ok)
            .with(true, () => taskEither.right(constVoid()))
            .with(
              false,
              () => () =>
                Promise.resolve(
                  either.left({
                    statusCode: response.statusCode,
                    statusMessage: response.statusMessage,
                    body: response.body,
                  })
                )
            )
            .exhaustive()
        )
      )
    ),
    taskEither.match(
      (error): NetlifyResponse => {
        const errorMessage = "Failed to send to Sentry";
        console.error(errorMessage, error);
        return { statusCode: 400, body: errorMessage };
      },
      (): NetlifyResponse => ({ statusCode: 200 })
    )
  )();

export { handler };
