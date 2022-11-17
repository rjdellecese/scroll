import { SignUp } from "@clerk/clerk-react";
import React from "react";

import { ClerkLayout } from "~src/elm-ts/clerk-layout";
import * as route from "~src/elm-ts/route";

export const view = () => (
  <ClerkLayout>
    <SignUp signInUrl={route.toString(route.signIn)} />
  </ClerkLayout>
);
