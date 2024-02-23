import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { cmd, react as html, sub, time } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Location } from "elm-ts/lib/Navigation";
import { push } from "elm-ts/lib/Navigation";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { tuple } from "fp-ts";
import { apply, constVoid, flow, pipe } from "fp-ts/lib/function";
import { Lens } from "monocle-ts";
import type { Dispatch, ReactNode } from "react";
import React, { useEffect, useState } from "react";
import { match, P } from "ts-pattern";

import * as clerkPublishableKey from "~src/clerk-publishable-key";
import * as page from "~src/elm-ts/app/page";
import { appearance } from "~src/elm-ts/clerk-appearance";
import { ClerkLayout } from "~src/elm-ts/clerk-layout";
import * as cmdExtra from "~src/elm-ts/cmd-extra";
import type { Flags } from "~src/elm-ts/flags";
import { LoadingSpinner } from "~src/elm-ts/loading-spinner";
import type { Stage } from "~src/elm-ts/stage";

// MODEL

type Model = {
  stage: Stage;
  currentTime: number;
  convex: ConvexReactClient;
  page: page.Model;
  areFontsLoaded: boolean;
};

export const init: (
  flags: Flags,
) => (location: Location) => [Model, Cmd<Msg>] = (flags) => (location) =>
  pipe(
    page.init(location),
    tuple.bimap(
      flow(
        cmd.map((pageMsg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg })),
        (cmd_: Cmd<Msg>) => cmd.batch([cmd_, loadFontsAndNotifyWhenLoaded]),
      ),
      (pageModel) => ({
        stage: flags.stage,
        currentTime: flags.time,
        convex: new ConvexReactClient(flags.convexUrl),
        page: pageModel,
        areFontsLoaded: false,
      }),
    ),
  );

// Prevent Flash Of Unstyled Text (FOUT), which can cause a layout shift.
// Reference: https://dev.to/fyfirman/how-to-fix-fout-flash-of-unstyled-text-in-react-1dl1
const loadFontsAndNotifyWhenLoaded: Cmd<Msg> = cmdExtra.fromTask(() =>
  Promise.all([
    document.fonts.load("16px MulishVariable"),
    document.fonts.load("16px LoraVariable"),
    document.fonts.load("16px JetBrains MonoVariable"),
  ]).then((): Msg => ({ _tag: "FontsLoaded" })),
);

export const locationToMsg = (location: Location): Msg => ({
  _tag: "GotPageMsg",
  msg: page.locationToMsg(location),
});

// UPDATE

export type Msg =
  | { _tag: "GotPageMsg"; msg: page.Msg }
  | { _tag: "FontsLoaded" }
  | { _tag: "NotSignedIn" }
  | { _tag: "Tick"; newTime: number };

export const update = (msg: Msg, model: Model): [Model, Cmd<Msg>] =>
  match<[Msg, Model], [Model, Cmd<Msg>]>([msg, model])
    .with(
      [
        { _tag: "GotPageMsg", msg: P.select("pageMsg") },
        { page: P.select("pageModel") },
      ],
      ({ pageMsg, pageModel }) =>
        pipe(
          page.update(model.stage, model.convex)(pageMsg, pageModel),
          tuple.bimap(
            cmd.map((pageMsg_) => ({ _tag: "GotPageMsg", msg: pageMsg_ })),
            (pageModel_) => ({ ...model, page: pageModel_ }),
          ),
        ),
    )
    .with([{ _tag: "FontsLoaded" }, P.any], () => [
      Lens.fromProp<Model>()("areFontsLoaded").set(true)(model),
      cmd.none,
    ])
    .with([{ _tag: "NotSignedIn" }, P.any], () => [model, push("/sign-in")])
    .with([{ _tag: "Tick", newTime: P.select() }, P.any], (newTime) => [
      Lens.fromProp<Model>()("currentTime").set(newTime)(model),
      cmd.none,
    ])
    .exhaustive();

// VIEW

const ConvexProviderWithClerk = ({
  children,
  dispatch,
  convexClient,
  isAuthPage,
  areFontsLoaded,
}: {
  children?: ReactNode;
  dispatch: Dispatch<Msg>;
  convexClient: ConvexReactClient;
  isAuthPage: boolean;
  areFontsLoaded: boolean;
}) => {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [clientAuthed, setClientAuthed] = useState(false);

  useEffect(() => {
    async function setAuth() {
      const fetchToken = async () => {
        const token = await getToken({ template: "convex", skipCache: true });
        setClientAuthed(true);
        return token;
      };
      convexClient.setAuth(fetchToken);
    }

    match(isSignedIn)
      .with(undefined, constVoid)
      .with(true, () => {
        const intervalId = setInterval(() => setAuth(), 50000);
        setAuth();
        return () => {
          clearInterval(intervalId);
        };
      })
      .with(false, () =>
        match(isAuthPage)
          .with(true, constVoid)
          .with(false, () => dispatch({ _tag: "NotSignedIn" }))
          .exhaustive(),
      )
      .exhaustive();
  }, [convexClient, isSignedIn, isAuthPage, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isLoaded || !areFontsLoaded || (isSignedIn && !clientAuthed)) {
    return (
      <ClerkLayout>
        <LoadingSpinner />
      </ClerkLayout>
    );
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
};

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) => (
  <ClerkProvider
    publishableKey={clerkPublishableKey.fromStage(model.stage)}
    appearance={appearance}
  >
    <ConvexProviderWithClerk
      dispatch={dispatch}
      convexClient={model.convex}
      isAuthPage={page.isAuthPage(model.page)}
      areFontsLoaded={model.areFontsLoaded}
    >
      {pipe(
        model.page,
        page.view(model.currentTime),
        html.map((pageMsg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg })),
        apply(dispatch),
      )}
    </ConvexProviderWithClerk>
  </ClerkProvider>
);

// SUBSCRIPTIONS

export const subscriptions = (model: Model): Sub<Msg> =>
  sub.batch([
    time.every(1000, (newTime) => ({ _tag: "Tick", newTime })),
    sub.map((pageMsg: page.Msg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg }))(
      page.subscriptions(model.page),
    ),
  ]);
