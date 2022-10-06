import { Location } from "elm-ts/lib/Navigation";
import * as r from "fp-ts-routing";

export type Route = Main | NotFound;

type Main = {
  _tag: "Main";
};

type NotFound = {
  _tag: "NotFound";
};

const main: Route = { _tag: "Main" };

const notFound: Route = { _tag: "NotFound" };

export const defaultRoute: Route = main;

const defaults = r.end;

const router = r.zero<Route>().alt(defaults.parser.map(() => main));

export const fromLocation = (location: Location): Route =>
  r.parse(router, r.Route.parse(location.pathname), notFound);
