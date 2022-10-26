import * as Sentry from "@sentry/browser";
import { BrowserTracing } from "@sentry/tracing";
import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import { programWithFlags } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { pipe } from "fp-ts/lib/function";
import { render } from "react-dom";
import { match } from "ts-pattern";

import * as app from "~/src/frontend/app";
import * as flags from "~/src/frontend/flags";
import * as stage from "~src/frontend/stage";

pipe(
  process.env.NODE_ENV,
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
          dsn: "https://49a723076cc84925bfb2265827ca1270@o4504010981179392.ingest.sentry.io/4504010983604224",
          integrations: [new BrowserTracing()],

          // Set tracesSampleRate to 1.0 to capture 100%
          // of transactions for performance monitoring.
          // We recommend adjusting this value in production
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
