import { describe, expect, test } from "@jest/globals";
import type { Arbitrary } from "fast-check";
import * as fc from "fast-check";
import { array } from "fp-ts";
import { pipe } from "fp-ts/lib/function";

import type { NotFound, Route } from "~src/elm-ts/route";
import * as route from "~src/elm-ts/route";

describe("router", () => {
  test("parses the home route", () => {
    fc.assert(
      fc.property(homePathArbitrary(), (pathname: string) => {
        expect(route.fromLocationPathname(pathname)).toEqual({ _tag: "Home" });
      }),
    );
  });
  test("parses the sign in route", () => {
    fc.assert(
      fc.property(signInPathArbitrary(), (pathname: string) => {
        expect(route.fromLocationPathname(pathname)).toEqual({
          _tag: "SignIn",
        });
      }),
    );
  });
  test("parses the sign up route", () => {
    fc.assert(
      fc.property(signUpPathArbitrary(), (pathname: string) => {
        expect(route.fromLocationPathname(pathname)).toEqual({
          _tag: "SignUp",
        });
      }),
    );
  });
  test("fromLocationPathname is the left inverse of toString", () => {
    fc.assert(
      fc.property(
        routeLessNotFoundArbitrary(),
        (route_: Exclude<Route, NotFound>) => {
          expect(
            pipe(route_, route.toString, route.fromLocationPathname),
          ).toEqual(route_);
        },
      ),
    );
  });
});

const routeLessNotFoundArbitrary: () => Arbitrary<
  Exclude<Route, NotFound>
> = () =>
  fc.oneof(
    fc.constant(route.home),
    fc.constant(route.signIn),
    fc.constant(route.signUp),
  );

const homePaths: ["", "/"] = ["", "/"];
const homePathArbitrary: () => Arbitrary<string> = () =>
  fc.oneof(...array.map(fc.constant)(homePaths));

const signInPath: "sign-in" = "sign-in";
const signInPathArbitrary: () => Arbitrary<string> = () =>
  fc.constant(signInPath);

const signUpPath: "sign-up" = "sign-up";
const signUpPathArbitrary: () => Arbitrary<string> = () =>
  fc.constant(signUpPath);
