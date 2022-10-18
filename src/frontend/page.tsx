import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Location } from "elm-ts/lib/Navigation";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { tuple } from "fp-ts";
import { flow, pipe } from "fp-ts/function";
import * as React from "react";
import { match, P } from "ts-pattern";

import type { ConvexAPI } from "~src/backend/_generated/react";
import type { ElmTsConvexClient } from "~src/frontend/elmTsConvexClient";
import * as home from "~src/frontend/page/home";
import type { Route } from "~src/frontend/route";
import * as route from "~src/frontend/route";

import type { Flags } from "./flags";

// MODEL

export type Model = {
  convexClient: ElmTsConvexClient<ConvexAPI>;
  page: Page;
};

type Page =
  | {
      _tag: "Home";
      model: home.Model;
    }
  | { _tag: "NotFound" };

export const locationToMsg = (location: Location): Msg => ({
  _tag: "RouteChanged",
  route: route.fromLocation(location),
});

const routeToModelCmd =
  (convexClient: ElmTsConvexClient<ConvexAPI>) =>
  (route: Route): [Model, Cmd<Msg>] =>
    pipe(
      match<Route, [Page, Cmd<Msg>]>(route)
        .with({ _tag: "Home" }, () => [
          {
            _tag: "Home",
            model: home.init(convexClient),
          },
          cmd.none,
        ])
        .with({ _tag: "NotFound" }, () => [{ _tag: "NotFound" }, cmd.none])
        .exhaustive(),
      tuple.mapFst((page) => ({ convexClient: convexClient, page }))
    );

export const init: (
  flags: Flags
) => (location: Location) => [Model, Cmd<Msg>] = (flags) =>
  flow(route.fromLocation, routeToModelCmd(flags.convexClient));

// MESSAGES

export type Msg =
  | { _tag: "GotHomeMsg"; msg: home.Msg }
  | { _tag: "RouteChanged"; route: Route };

// UPDATE

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Page], [Model, Cmd<Msg>]>([msg, model.page])
    .with(
      [
        { _tag: "GotHomeMsg", msg: P.select("homeMsg") },
        {
          _tag: "Home",
          model: P.select("homeModel"),
        },
      ],
      ({ homeMsg, homeModel }) =>
        pipe(
          home.update(model.convexClient)(homeMsg, homeModel),
          tuple.bimap(
            cmd.map((homeMsg_) => ({ _tag: "GotHomeMsg", msg: homeMsg_ })),
            (homeModel_) => ({
              convexClient: model.convexClient,
              page: { _tag: "Home", model: homeModel_ },
            })
          )
        )
    )
    .with(
      [{ _tag: "RouteChanged", route: P.select() }, P.any],
      routeToModelCmd(model.convexClient)
    )
    .otherwise(() => [model, cmd.none]);

// VIEW

export const view = (model: Model): Html<Msg> =>
  match<Page, Html<Msg>>(model.page)
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

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = (
  model: Model
): Sub<Msg> =>
  match<Page, Sub<Msg>>(model.page)
    .with(
      {
        _tag: "Home",
        model: P.select("homeModel"),
      },
      ({ homeModel }) =>
        pipe(
          home.subscriptions(model.convexClient)(homeModel),
          sub.map((homeMsg) => ({ _tag: "GotHomeMsg", msg: homeMsg }))
        )
    )
    .with({ _tag: "NotFound" }, () => sub.none)
    .exhaustive();
