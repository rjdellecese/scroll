import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import { programWithFlags } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { render } from "react-dom";

import * as flags from "~/src/frontend/flags";
import * as page from "~/src/frontend/page";

const program =
  process.env.NODE_ENV === "production"
    ? programWithFlags
    : programWithDebuggerWithFlags;

const main = program(
  page.locationToMsg,
  page.init,
  page.update,
  page.view,
  page.subscriptions
);

React.run(main(flags.init()), (dom) =>
  render(dom, document.getElementById("app"))
);
