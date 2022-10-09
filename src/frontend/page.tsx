import { cmd, html } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Location } from "elm-ts/lib/Navigation";
import type { Html } from "elm-ts/lib/React";
import { tuple } from "fp-ts";
import { flow, pipe } from "fp-ts/function";
import * as React from "react";
import { match, P } from "ts-pattern";

import * as cmdExtra from "~/src/frontend/cmdExtra";
import * as convexClient from "~src/frontend/convexClient";
import * as home from "~src/frontend/page/home";
import type { Route } from "~src/frontend/route";
import * as route from "~src/frontend/route";

// MODEL

export type Model = { _tag: "Home"; model: home.Model } | { _tag: "NotFound" };

export const locationToMsg = (location: Location): Msg => ({
  _tag: "RouteChanged",
  route: route.fromLocation(location),
});

const routeToModelCmd = (route: Route): [Model, Cmd<Msg>] =>
  match<Route, [Model, Cmd<Msg>]>(route)
    .with({ _tag: "Home" }, () =>
      pipe(
        home.init,
        tuple.bimap(
          cmd.map((homeMsg) => ({ _tag: "GotHomeMsg", msg: homeMsg })),
          (homeModel) => ({ _tag: "Home", model: homeModel })
        )
      )
    )
    .with({ _tag: "NotFound" }, () => [{ _tag: "NotFound" }, cmd.none])
    .exhaustive();

export const init: (location: Location) => [Model, Cmd<Msg>] = flow(
  route.fromLocation,
  routeToModelCmd,
  tuple.mapSnd((cmd_) =>
    cmd.batch([cmd_, cmdExtra.ignore(cmdExtra.fromIO(convexClient.create))])
  )
);

// MESSAGES

export type Msg =
  | { _tag: "GotHomeMsg"; msg: home.Msg }
  | { _tag: "RouteChanged"; route: Route };

// UPDATE

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
    .with(
      [
        { _tag: "GotHomeMsg", msg: P.select("homeMsg") },
        { _tag: "Home", model: P.select("homeModel") },
      ],
      ({ homeMsg, homeModel }) =>
        pipe(
          home.update(homeMsg, homeModel),
          tuple.bimap(
            cmd.map((homeMsg_) => ({ _tag: "GotHomeMsg", msg: homeMsg_ })),
            (homeModel_) => ({ _tag: "Home", model: homeModel_ })
          )
        )
    )
    .with([{ _tag: "RouteChanged", route: P.select() }, P.any], routeToModelCmd)
    .otherwise(() => [model, cmd.none]);

// VIEW

export const view = (model: Model): Html<Msg> =>
  match<Model, Html<Msg>>(model)
    .with(
      { _tag: "Home", model: P.select() },
      flow(
        home.view,
        html.map((homeMsg) => ({ _tag: "GotHomeMsg", msg: homeMsg }))
      )
    )
    .with({ _tag: "NotFound" }, () => notFoundView)
    .exhaustive();

const notFoundView: Html<Msg> = () => <div>Page not found!</div>;
