import * as Sentry from "@sentry/browser";
import type { Cmd } from "elm-ts/lib/Cmd";
import { io } from "fp-ts";
import * as array from "fp-ts/Array";
import * as console from "fp-ts/Console";
import type * as E from "fp-ts/Eq";
import { constant, constVoid, flow, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/IO";
import type * as M from "fp-ts/Monoid";
import type * as t from "io-ts";
import * as pathReporter from "io-ts/PathReporter";
import { match, P } from "ts-pattern";

import * as cmdExtra from "~src/elm-ts/cmd-extra";
import type { Stage } from "~src/elm-ts/stage";

export type LogMessage = InternalLogMessage[];

// `"Error"`s are created by us, `"Exception"`s are created by the code we call, and captured by us.
type InternalLogMessage =
  | {
      tag: "Error";
      message: string;
      details?: Details;
    }
  | { tag: "Exception"; exception: unknown };

export type Details = { [key: string]: unknown };

// TYPECLASS MEMBERS

export const Eq: E.Eq<LogMessage> = {
  equals: (x, y) => {
    const internalLogMessageEq: E.Eq<InternalLogMessage> = {
      equals: (x_, y_) => x_ === y_,
    };

    return array.getEq(internalLogMessageEq).equals(x, y);
  },
};

export const Monoid: M.Monoid<LogMessage> = {
  concat: (x, y) => array.concat(y)(x),
  empty: [],
};

// CONSTRUCTORS

export function error(message: string, details: Details = {}): LogMessage {
  return [
    {
      tag: "Error",
      message,
      details,
    },
  ];
}

export function exception(exception: unknown): LogMessage {
  return [{ tag: "Exception", exception: exception }];
}

export function fromValidationErrors(codecErrors: t.Errors): LogMessage {
  return pipe(
    codecErrors,
    pathReporter.failure,
    (pathReportorErrors: string[]) =>
      error("Validation failed", { errors: pathReportorErrors })
  );
}

// EFFECTS

export const report: (
  stage: Stage
) => (logMessage: LogMessage) => Cmd<never> = (stage) =>
  flow(reportIO(stage), cmdExtra.fromIOVoid);

export function reportIO(stage: Stage): (logMessage: LogMessage) => IO<void> {
  return match(stage)
    .with("Development", () => reportToConsoleIO)
    .with("Production", () => reportToSentryIO)
    .exhaustive();
}

function reportToSentryIO(logMessage: LogMessage): IO<void> {
  const reportInternalLogMessage: (
    internalLogMessage: InternalLogMessage
  ) => IO<void> = (internalLogMessage) =>
    pipe(
      match(internalLogMessage)
        .with({ tag: "Error" }, ({ message, details }) =>
          pipe(() =>
            Sentry.captureMessage(message, {
              ...(() =>
                details
                  ? {
                      contexts: {
                        details: details,
                      },
                    }
                  : {})(),
              tags: { route: window.location.pathname },
            })
          )
        )
        .with(
          { tag: "Exception", exception: P.select() },
          (exception) => () => Sentry.captureException(exception)
        )
        .exhaustive(),
      io.map(constVoid)
    );

  return pipe(
    logMessage,
    array.map(reportInternalLogMessage),
    array.reduce(constVoid, (b, a) => io.chain(constant(a))(b))
  );
}

function reportToConsoleIO(logMessage: LogMessage): IO<void> {
  return pipe(logMessage, console.error, io.map(constVoid));
}
