import * as r from "fp-ts-routing";
import { match } from "ts-pattern";

export type Route = Home | SignIn | SignUp | NotFound;

export type Home = {
  _tag: "Home";
};

export type SignIn = {
  _tag: "SignIn";
};

export type SignUp = {
  _tag: "SignUp";
};

export type NotFound = {
  _tag: "NotFound";
};

export const home: Home = { _tag: "Home" };
export const signIn: SignIn = { _tag: "SignIn" };
export const signUp: SignUp = { _tag: "SignUp" };

export const notFound: NotFound = { _tag: "NotFound" };

export const toString = (route: Exclude<Route, NotFound>): string =>
  match(route)
    .with({ _tag: "Home" }, () => "/")
    .with({ _tag: "SignIn" }, () => "/sign-in")
    .with({ _tag: "SignUp" }, () => "/sign-up")
    .exhaustive();

export const defaultRoute: Route = home;

const defaults = r.end;
const signInMatch = r.lit("sign-in").then(r.end);
const signUpMatch = r.lit("sign-up").then(r.end);

const router = r
  .zero<Route>()
  .alt(defaults.parser.map(() => home))
  .alt(signInMatch.parser.map(() => signIn))
  .alt(signUpMatch.parser.map(() => signUp));

export const fromLocationPathname = (pathname: string): Route =>
  r.parse(router, r.Route.parse(pathname), notFound);
