import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import { programWithFlags } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { render } from "react-dom";
import * as Navigation from "~/src/Navigation";

const program =
  process.env.NODE_ENV === "production"
    ? programWithFlags
    : programWithDebuggerWithFlags;

const main = program(
  Navigation.locationToMsg,
  Navigation.init,
  Navigation.update,
  Navigation.view
);

React.run(main(null), (dom) => render(dom, document.getElementById("app")));
