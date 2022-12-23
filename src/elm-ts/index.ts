import "@fontsource/jetbrains-mono/variable.css";
import "@fontsource/mulish/variable.css";
import "@fontsource/mulish/variable-italic.css";
import "@fontsource/lora/variable.css";
import "@fontsource/lora/variable-italic.css";

import * as Sentry from "@sentry/browser";
import { BrowserTracing } from "@sentry/tracing";
import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import { programWithFlags } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { either } from "fp-ts";
import type { Either } from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import type { Option } from "fp-ts/lib/Option";
import { createRoot } from "react-dom/client";
import { match, P } from "ts-pattern";

import * as app from "~/src/elm-ts/app";
import type { Stage } from "~src/elm-ts/stage";
import * as stage from "~src/elm-ts/stage";
import * as sentryConfig from "~src/sentry-config";

pipe(
  either.Do,
  either.bind("stageAndProgram", () =>
    match<
      Option<Stage>,
      Either<string, { stage: Stage; program: typeof programWithFlags }>
    >(stage.fromNodeEnv(process.env["NODE_ENV"]))
      .with({ _tag: "None" }, () => either.left("Failed to determine stage"))
      .with(
        { _tag: "Some", value: P.select("stage_", "Development") },
        ({ stage_ }) =>
          either.right({ stage: stage_, program: programWithDebuggerWithFlags })
      )
      .with(
        { _tag: "Some", value: P.select("stage_", "Production") },
        ({ stage_ }) => {
          Sentry.init({
            dsn: sentryConfig.dsn,
            tunnel: "/.netlify/functions/tunnel-to-sentry",
            integrations: [new BrowserTracing()],
            tracesSampleRate: 1.0,
          });

          return either.right({ stage: stage_, program: programWithFlags });
        }
      )
      .exhaustive()
  ),
  either.bind("time", () => either.right(new Date().getTime())),
  either.bind("root", () =>
    pipe(
      document.getElementById("app"),
      either.fromNullable("Failed to find app element"),
      either.map(createRoot)
    )
  ),
  either.match(
    (errorMessage) => {
      throw new Error(errorMessage);
    },
    ({ root, time, stageAndProgram }) => {
      React.run(
        stageAndProgram.program(
          app.locationToMsg,
          app.init,
          app.update,
          app.view,
          app.subscriptions
        )({ time, stage: stageAndProgram.stage }),
        (dom) => root.render(dom)
      );
    }
  )
);

// https://parceljs.org/languages/javascript/#service-workers
navigator.serviceWorker.register(
  new URL("service-worker.ts", import.meta.url),
  { type: "module" }
);
