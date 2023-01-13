import { Loader2 } from "lucide-react";
import type { ReactElement, SVGProps } from "react";
import React from "react";

type Props = SVGProps<SVGSVGElement>;

export const LoadingSpinner = (props: Props): ReactElement => (
  <Loader2
    {...props}
    className={`animate-spin -ml-1 mr-3 h-5 w-5 ${props.className || ""}`}
  />
);
