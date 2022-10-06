import * as React from "react";
import { Html } from "elm-ts/lib/React";
import { match, P } from "ts-pattern";
import { Cmd } from "elm-ts/lib/Cmd";
import { cmd } from "elm-ts";

// MODEl

export type Model = boolean;

export const init = true;

// UPDATE

export type Msg = { _tag: "RouteBButtonClicked" };

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
    .with([{ _tag: "RouteBButtonClicked" }, P.any], ([, model]) => [
      model,
      cmd.none,
    ])
    .exhaustive();

// VIEW
export const view: (model: Model) => Html<Msg> = (model: Model) => (dispatch) =>
  (
    <div>
      Hello world!
      <button onClick={() => dispatch({ _tag: "RouteBButtonClicked" })}>
        RouteB
      </button>
    </div>
  );
