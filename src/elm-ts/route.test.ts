import { describe, expect, test } from "@jest/globals";
import type { Arbitrary } from "fast-check";
import * as fc from "fast-check";
import { array, string } from "fp-ts";

import { fromLocationPathname } from "~src/elm-ts/route";

describe("router", () => {
  test('parses "" or "/" as the home route', () => {
    fc.assert(
      fc.property(homePathArbitrary(), (pathname: string) => {
        expect(fromLocationPathname(pathname)).toEqual({ _tag: "Home" });
      })
    );
  });
  test("parses any other path as the not found route", () => {
    fc.assert(
      fc.property(notFoundPathArbitrary(), (pathname: string) => {
        expect(fromLocationPathname(pathname)).toEqual({ _tag: "NotFound" });
      })
    );
  });
});

const homePaths: ["", "/"] = ["", "/"];

const homePathArbitrary: () => Arbitrary<string> = () =>
  fc.oneof(...array.map(fc.constant)(homePaths));

const notFoundPathArbitrary: () => Arbitrary<string> = () =>
  fc
    .webPath()
    .filter(
      (webPath: string): boolean =>
        !array.exists((homePath: string): boolean =>
          string.Eq.equals(webPath, homePath)
        )(homePaths)
    );
