import * as Sentry from "@sentry/browser";
import { BrowserTracing } from "@sentry/tracing";
import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import { programWithFlags } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { render } from "react-dom";

import * as app from "~/src/frontend/app";
import * as flags from "~/src/frontend/flags";

// TODO: Conditional based on environment, at least
Sentry.init({
  dsn: "https://49a723076cc84925bfb2265827ca1270@o4504010981179392.ingest.sentry.io/4504010983604224",
  integrations: [new BrowserTracing()],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 1.0,
});

const program =
  process.env.NODE_ENV === "production"
    ? programWithFlags
    : programWithDebuggerWithFlags;

const main = program(
  app.locationToMsg,
  app.init,
  app.update,
  app.view,
  app.subscriptions
);

React.run(main(flags.init()), (dom) =>
  render(dom, document.getElementById("app"))
);
