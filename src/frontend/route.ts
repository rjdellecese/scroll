import type { Location } from "elm-ts/lib/Navigation";
import * as r from "fp-ts-routing";

export type Route = Home | NotFound;

type Home = {
  _tag: "Home";
};

type NotFound = {
  _tag: "NotFound";
};

const home: Route = { _tag: "Home" };

const notFound: Route = { _tag: "NotFound" };

export const defaultRoute: Route = home;

const defaults = r.end;

const router = r.zero<Route>().alt(defaults.parser.map(() => home));

export const fromLocation = (location: Location): Route =>
  r.parse(router, r.Route.parse(location.pathname), notFound);
