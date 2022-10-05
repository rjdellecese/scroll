import * as React from "react";
import { cmd } from "elm-ts";
import { Location, push } from "elm-ts/lib/Navigation";
import { Html } from "elm-ts/lib/React";

// ROUTES
const routes = {
  RouteA: true,
  RouteB: true,
};

type Route = keyof typeof routes;

// FLAGS
export type Flags = Model;

const defaultRoute: Route = "RouteA";

export const flags: Flags = defaultRoute;

// MODEL
export type Model = Route;

function isRoute(route: string): route is Route {
  return routes.hasOwnProperty(route);
}

function getRoute(location: Location): Route {
  const route = location.pathname.substring(1);
  return isRoute(route) ? route : defaultRoute;
}

export function locationToMsg(location: Location): Msg {
  return { type: getRoute(location) } as Msg;
}

export function init(_: Flags): (location: Location) => [Model, cmd.Cmd<Msg>] {
  return (location) => [getRoute(location), cmd.none];
}

// MESSAGES
export type Msg =
  | { type: "RouteA" }
  | { type: "RouteB" }
  | { type: "Push"; url: Route };

// UPDATE
export function update(msg: Msg, model: Model): [Model, cmd.Cmd<Msg>] {
  switch (msg.type) {
    case "RouteA":
      return ["RouteA", cmd.none];

    case "RouteB":
      return ["RouteB", cmd.none];

    case "Push":
      return [model, push(msg.url)];
  }
}

// VIEW
export function view(model: Model): Html<Msg> {
  return (dispatch) => (
    <div>{model === "RouteA" ? RouteA(dispatch) : RouteB(dispatch)}</div>
  );
}

const RouteA: Html<Msg> = (dispatch) => (
  <div>
    RouteA{" "}
    <button onClick={() => dispatch({ type: "Push", url: "RouteB" })}>
      RouteB
    </button>
  </div>
);

const RouteB: Html<Msg> = (dispatch) => (
  <div>
    RouteB{" "}
    <button onClick={() => dispatch({ type: "Push", url: "RouteA" })}>
      RouteA
    </button>
  </div>
);
