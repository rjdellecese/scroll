import type { ReactElement, ReactNode } from "react";
import React from "react";

export const ClerkLayout = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => (
  <div className="grid w-screen h-screen pt-[clamp(2rem,10vw,5rem)] justify-items-center">
    {children}
  </div>
);
