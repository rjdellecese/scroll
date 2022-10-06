import * as React from "react";
import { cmd, html } from "elm-ts";
import { Location } from "elm-ts/lib/Navigation";
import { Html } from "elm-ts/lib/React";
import * as home from "~src/page/home";
import { match, P } from "ts-pattern";
import { Cmd } from "elm-ts/lib/Cmd";
import * as route from "~src/route";
import type { Route } from "~src/route";
import { flow, pipe } from "fp-ts/function";
import { tuple } from "fp-ts";

// MODEL
export type Model = { _tag: "Main"; model: home.Model } | { _tag: "NotFound" };

export const locationToMsg = (location: Location): Msg => ({
  _tag: "RouteChanged",
  route: route.fromLocation(location),
});

const routeToModelCmd = (route: Route): [Model, Cmd<Msg>] =>
  match<Route, [Model, Cmd<Msg>]>(route)
    .with({ _tag: "Main" }, () => [
      { _tag: "Main", model: home.init },
      cmd.none,
    ])
    .with({ _tag: "NotFound" }, () => [{ _tag: "NotFound" }, cmd.none])
    .exhaustive();

export const init: (location: Location) => [Model, Cmd<Msg>] = flow(
  route.fromLocation,
  routeToModelCmd
);

// MESSAGES
export type Msg =
  | { _tag: "GotMainMsg"; msg: home.Msg }
  | { _tag: "RouteChanged"; route: Route };

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
          home.update(mainMsg, mainModel),
          tuple.bimap(
            cmd.map((mainMsg_) => ({ _tag: "GotMainMsg", msg: mainMsg_ })),
            (mainModel_) => ({ _tag: "Main", model: mainModel_ })
          )
        )
    )
    .with([{ _tag: "RouteChanged", route: P.select() }, P.any], routeToModelCmd)
    .otherwise(() => [model, cmd.none]);

// VIEW
export const view = (model: Model): Html<Msg> =>
  match<Model, Html<Msg>>(model)
    .with(
      { _tag: "Main", model: P.select() },
      flow(
        home.view,
        html.map((mainMsg) => ({ _tag: "GotMainMsg", msg: mainMsg }))
      )
    )
    .with({ _tag: "NotFound" }, () => notFoundView)
    .exhaustive();

const notFoundView: Html<Msg> = () => <div>Page not found!</div>;
