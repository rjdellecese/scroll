import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { cmd, react as html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Location } from "elm-ts/lib/Navigation";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { tuple } from "fp-ts";
import { apply, pipe } from "fp-ts/lib/function";
import React from "react";
import { match, P } from "ts-pattern";

import clientConfig from "~src/convex/_generated/clientConfig";
import type { ConvexAPI } from "~src/convex/_generated/react";
import * as page from "~src/frontend/app/page";
import type { Flags } from "~src/frontend/flags";

// MODEL

type Model = { convex: ConvexReactClient<ConvexAPI>; page: page.Model };

export const init: (
  flags: Flags
) => (location: Location) => [Model, Cmd<Msg>] = (flags) => (location) =>
  pipe(
    page.init(flags)(location),
    tuple.bimap(
      cmd.map((pageMsg) => ({ _tag: "GotPageMsg", msg: pageMsg })),
      (pageModel) => ({
        convex: new ConvexReactClient(clientConfig),
        page: pageModel,
      })
    )
  );

export const locationToMsg = (location: Location): Msg => ({
  _tag: "GotPageMsg",
  msg: page.locationToMsg(location),
});

// UPDATE

export type Msg = { _tag: "GotPageMsg"; msg: page.Msg };

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
    .with(
      [
        { _tag: "GotPageMsg", msg: P.select("pageMsg") },
        { page: P.select("pageModel") },
      ],
      ({ pageMsg, pageModel }) =>
        pipe(
          page.update(model.convex)(pageMsg, pageModel),
          tuple.bimap(
            cmd.map((pageMsg_) => ({ _tag: "GotPageMsg", msg: pageMsg_ })),
            (pageModel_) => ({ ...model, page: pageModel_ })
          )
        )
    )
    .exhaustive();

// VIEW

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) => {
  return (
    <ConvexProvider client={model.convex}>
      {pipe(
        model.page,
        page.view,
        html.map((pageMsg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg })),
        apply(dispatch)
      )}
    </ConvexProvider>
  );
};

// SUBSCRIPTIONS

export const subscriptions = (model: Model): Sub<Msg> =>
  sub.map((pageMsg: page.Msg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg }))(
    page.subscriptions(model.page)
  );
