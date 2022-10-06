import { programWithDebugger } from "elm-ts/lib/Debug/Navigation";
import { program } from "elm-ts/lib/Navigation";
import * as React from "elm-ts/lib/React";
import { render } from "react-dom";
import * as page from "~/src/page";

const program_ =
  process.env.NODE_ENV === "production" ? program : programWithDebugger;

const main = program_(page.locationToMsg, page.init, page.update, page.view);

React.run(main, (dom) => render(dom, document.getElementById("app")));
