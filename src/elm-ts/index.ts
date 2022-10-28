import * as Sentry from "@sentry/browser";
import { BrowserTracing } from "@sentry/tracing";
import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import { programWithFlags } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { pipe } from "fp-ts/lib/function";
import { render } from "react-dom";
import { match } from "ts-pattern";

import * as app from "~/src/elm-ts/app";
import * as flags from "~/src/elm-ts/flags";
import * as stage from "~src/elm-ts/stage";
import * as sentryConfig from "~src/sentry-config";

pipe(
  process.env["NODE_ENV"],
  stage.fromNodeEnv,
  (optionStage) =>
    match(optionStage)
      .with({ _tag: "None" }, () => {
        throw "Failed to determine stage";
      })
      .with(
        { _tag: "Some", value: "Development" },
        () => programWithDebuggerWithFlags
      )
      .with({ _tag: "Some", value: "Production" }, () => {
        Sentry.init({
          dsn: sentryConfig.dsn,
          tunnel: "/.netlify/functions/tunnel-to-sentry",
          integrations: [new BrowserTracing()],
          tracesSampleRate: 1.0,
        });

        return programWithFlags;
      })
      .exhaustive(),
  (program) =>
    program(
      app.locationToMsg,
      app.init,
      app.update,
      app.view,
      app.subscriptions
    ),
  (main) =>
    React.run(main(flags.init()), (dom) =>
      render(dom, document.getElementById("app"))
    )
);
