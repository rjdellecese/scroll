import * as React from "react";
import type { ReactNode } from "react";
import { cmd, html } from "elm-ts";
import { Location, push } from "elm-ts/lib/Navigation";
import { Dom, Html } from "elm-ts/lib/React";
import * as main from "~src/main";
import { match, P } from "ts-pattern";
import { Cmd } from "elm-ts/lib/Cmd";
import * as route from "~src/route";
import type { Route } from "~src/route";
import { flow, pipe } from "fp-ts/function";
import { tuple } from "fp-ts";

// FLAGS

export type Flags = null;

// MODEL
export type Model = { _tag: "Main"; model: main.Model } | { _tag: "NotFound" };

export const locationToMsg = (location: Location): Msg => ({
  _tag: "RouteChanged",
  route: route.fromLocation(location),
});

const routeToModelCmd = (route: Route): [Model, Cmd<Msg>] =>
  match<Route, [Model, Cmd<Msg>]>(route)
    .with({ _tag: "Main" }, () => [
      { _tag: "Main", model: main.init },
      cmd.none,
    ])
    .with({ _tag: "NotFound" }, () => [{ _tag: "NotFound" }, cmd.none])
    .exhaustive();

export const init: (
  flags: Flags
) => (location: Location) => [Model, Cmd<Msg>] = () =>
  flow(route.fromLocation, routeToModelCmd);

// MESSAGES
export type Msg =
  | { _tag: "GotMainMsg"; msg: main.Msg }
  | { _tag: "RouteChanged"; route: Route }
  | { _tag: "Push"; route: Route };

// UPDATE
export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
    .with(
      [
        { _tag: "GotMainMsg", msg: P.select("mainMsg") },
        { _tag: "Main", model: P.select("mainModel") },
      ],
      ({ mainMsg, mainModel }) =>
        pipe(
          main.update(mainMsg, mainModel),
          tuple.bimap(
            cmd.map((mainMsg_) => ({ _tag: "GotMainMsg", msg: mainMsg_ })),
            (mainModel_) => ({ _tag: "Main", model: mainModel_ })
          )
        )
    )
    .with([{ _tag: "RouteChanged", route: P.select() }, P.any], routeToModelCmd)
    .with([{ _tag: "Push" }, P.any], () => [model, cmd.none])
    .otherwise(() => [model, cmd.none]);

// VIEW
export const view = (model: Model): Html<Msg> =>
  match<Model, Html<Msg>>(model)
    .with(
      { _tag: "Main", model: P.select() },
      flow(
        main.view,
        html.map((mainMsg) => ({ _tag: "GotMainMsg", msg: mainMsg }))
      )
    )
    .with({ _tag: "NotFound" }, () => RouteB)
    .exhaustive();

const RouteB: Html<Msg> = (dispatch) => (
  <div>
    RouteB{" "}
    <button
      onClick={() => dispatch({ _tag: "Push", route: route.defaultRoute })}
    >
      RouteA
    </button>
  </div>
);
