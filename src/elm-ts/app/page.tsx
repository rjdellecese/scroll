import type { ConvexReactClient } from "convex/react";
import { cmd, html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Location } from "elm-ts/lib/Navigation";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { tuple } from "fp-ts";
import { flow, pipe } from "fp-ts/function";
import * as React from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import * as home from "~src/elm-ts/app/page/home";
import * as signIn from "~src/elm-ts/app/page/sign-in";
import * as signUp from "~src/elm-ts/app/page/sign-up";
import type { Route } from "~src/elm-ts/route";
import * as route from "~src/elm-ts/route";
import type { Stage } from "~src/elm-ts/stage";

// MODEL

export type Model =
  | {
      _tag: "Home";
      model: home.Model;
    }
  | { _tag: "SignIn" }
  | { _tag: "SignUp" }
  | { _tag: "NotFound" };

export const locationToMsg = (location: Location): Msg => ({
  _tag: "RouteChanged",
  route: route.fromLocationPathname(location.pathname),
});

const routeToModelCmd = (route_: Route): [Model, Cmd<Msg>] =>
  match<Route, [Model, Cmd<Msg>]>(route_)
    .with({ _tag: "Home" }, () => [
      {
        _tag: "Home",
        model: home.init,
      },
      cmd.none,
    ])
    .with({ _tag: "SignIn" }, () => [{ _tag: "SignIn" }, cmd.none])
    .with({ _tag: "SignUp" }, () => [{ _tag: "SignUp" }, cmd.none])
    .with({ _tag: "NotFound" }, () => [{ _tag: "NotFound" }, cmd.none])
    .exhaustive();

export const isAuthPage = (model: Model) =>
  match(model._tag)
    .with("SignIn", "SignUp", () => true)
    .otherwise(() => false);

export const init: (location: Location) => [Model, Cmd<Msg>] = (location) =>
  pipe(location.pathname, route.fromLocationPathname, routeToModelCmd);

// MESSAGES

export type Msg =
  | { _tag: "GotHomeMsg"; msg: home.Msg }
  | { _tag: "RouteChanged"; route: Route };

// UPDATE

export const update =
  (stage: Stage, convex: ConvexReactClient<API>) =>
  (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
    match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
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
            home.update(stage, convex)(homeMsg, homeModel),
            tuple.bimap(
              cmd.map((homeMsg_) => ({ _tag: "GotHomeMsg", msg: homeMsg_ })),
              (homeModel_) => ({ _tag: "Home", model: homeModel_ })
            )
          )
      )
      .with(
        [{ _tag: "RouteChanged", route: P.select() }, P.any],
        routeToModelCmd
      )
      .otherwise(() => [model, cmd.none]);

// VIEW

export const view =
  (currentTime: number) =>
  (model: Model): Html<Msg> =>
    match<Model, Html<Msg>>(model)
      .with(
        { _tag: "Home", model: P.select() },
        flow(
          home.view(currentTime),
          html.map((homeMsg): Msg => ({ _tag: "GotHomeMsg", msg: homeMsg }))
        )
      )
      .with({ _tag: "SignIn" }, () => signIn.view)
      .with({ _tag: "SignUp" }, () => signUp.view)
      .with({ _tag: "NotFound" }, () => notFoundView)
      .exhaustive();

const notFoundView: Html<Msg> = () => <div>Page not found!</div>;

// SUBSCRIPTIONS

export const subscriptions: (model: Model) => Sub<Msg> = (
  model: Model
): Sub<Msg> =>
  match<Model, Sub<Msg>>(model)
    .with(
      {
        _tag: "Home",
        model: P.select("homeModel"),
      },
      ({ homeModel }) =>
        pipe(
          home.subscriptions(homeModel),
          sub.map((homeMsg) => ({ _tag: "GotHomeMsg", msg: homeMsg }))
        )
    )
    .with({ _tag: "SignIn" }, () => sub.none)
    .with({ _tag: "SignUp" }, () => sub.none)
    .with({ _tag: "NotFound" }, () => sub.none)
    .exhaustive();
