import { programWithDebuggerWithFlags } from "elm-ts/lib/Debug/Navigation";
import * as Navigation from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { render } from "react-dom";
import * as component from "~/src/Navigation";

const program =
  process.env.NODE_ENV === "production"
    ? Navigation.programWithFlags
    : programWithDebuggerWithFlags;

const main = program(
  component.locationToMsg,
  component.init,
  component.update,
  component.view
);

React.run(main(component.flags), (dom) =>
  render(dom, document.getElementById("app")!)
);
