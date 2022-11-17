import { SignIn } from "@clerk/clerk-react";
import type { Html } from "elm-ts/lib/React";
import React from "react";

import { ClerkLayout } from "~src/elm-ts/clerk-layout";
import * as route from "~src/elm-ts/route";

export const view: Html<never> = () => (
  <ClerkLayout>
    <SignIn signUpUrl={route.toString(route.signUp)} />
  </ClerkLayout>
);
