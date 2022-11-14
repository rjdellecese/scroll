import { ClerkProvider, RedirectToSignIn, useAuth } from "@clerk/clerk-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { cmd, react as html, sub } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Location } from "elm-ts/lib/Navigation";
import type { Html } from "elm-ts/lib/React";
import type { Sub } from "elm-ts/lib/Sub";
import { tuple } from "fp-ts";
import { apply, pipe } from "fp-ts/lib/function";
import type { ReactElement, ReactNode } from "react";
import React, { useEffect, useState } from "react";
import { match, P } from "ts-pattern";

import type { API } from "~src/convex/_generated/api";
import clientConfig from "~src/convex/_generated/clientConfig";
import * as page from "~src/elm-ts/app/page";
import { appearance } from "~src/elm-ts/clerk-appearance";
import type { Flags } from "~src/elm-ts/flags";
import { LoadingSpinner } from "~src/elm-ts/loading-spinner";
import type { Stage } from "~src/elm-ts/stage";

// MODEL

type Model = {
  stage: Stage;
  convex: ConvexReactClient<API>;
  page: page.Model;
};

export const init: (
  flags: Flags
) => (location: Location) => [Model, Cmd<Msg>] = (flags) => (location) =>
  pipe(
    page.init(location),
    tuple.bimap(
      cmd.map((pageMsg) => ({ _tag: "GotPageMsg", msg: pageMsg })),
      (pageModel) => ({
        stage: flags.stage,
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
          page.update(model.stage, model.convex)(pageMsg, pageModel),
          tuple.bimap(
            cmd.map((pageMsg_) => ({ _tag: "GotPageMsg", msg: pageMsg_ })),
            (pageModel_) => ({ ...model, page: pageModel_ })
          )
        )
    )
    .exhaustive();

// VIEW

const ConvexProviderWithClerk = ({
  children,
  convexClient,
  loading,
  loggedOut,
}: {
  children?: ReactNode;
  convexClient: ConvexReactClient<API>;
  loading?: ReactElement;
  loggedOut?: ReactElement;
}) => {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const [clientAuthed, setClientAuthed] = useState(false);

  useEffect(() => {
    async function setAuth() {
      const token = await getToken({ template: "convex", skipCache: true });
      if (token) {
        convexClient.setAuth(token);
        setClientAuthed(true);
      }
    }

    if (isSignedIn) {
      const intervalId = setInterval(() => setAuth(), 50000);
      setAuth();
      return () => {
        clearInterval(intervalId);
      };
    }
  }, [convexClient, getToken, isSignedIn]);

  if (!isLoaded || (isSignedIn && !clientAuthed)) {
    return loading || null;
  } else if (!isSignedIn) {
    return loggedOut || <RedirectToSignIn />;
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
};

export const view: (model: Model) => Html<Msg> = (model) => (dispatch) => {
  const clerkClassNames = "self-center place-self-center justify-self-center";

  return (
    <ClerkProvider
      frontendApi="clerk.concise.escargot-18.lcl.dev"
      appearance={appearance}
    >
      <ConvexProviderWithClerk
        convexClient={model.convex}
        loading={
          <div className="grid h-screen">
            <LoadingSpinner className={clerkClassNames} />
          </div>
        }
      >
        {pipe(
          model.page,
          page.view,
          html.map((pageMsg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg })),
          apply(dispatch)
        )}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
};

// SUBSCRIPTIONS

export const subscriptions = (model: Model): Sub<Msg> =>
  sub.map((pageMsg: page.Msg): Msg => ({ _tag: "GotPageMsg", msg: pageMsg }))(
    page.subscriptions(model.page)
  );
