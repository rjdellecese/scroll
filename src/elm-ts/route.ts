import * as r from "fp-ts-routing";

export type Route = Home | NotFound;

export type Home = {
  _tag: "Home";
};

export type NotFound = {
  _tag: "NotFound";
};

const home: Route = { _tag: "Home" };

const notFound: Route = { _tag: "NotFound" };

export const defaultRoute: Route = home;

const defaults = r.end;

const router = r.zero<Route>().alt(defaults.parser.map(() => home));

export const fromLocationPathname = (pathname: string): Route =>
  r.parse(router, r.Route.parse(pathname), notFound);
