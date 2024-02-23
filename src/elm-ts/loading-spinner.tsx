import type { LucideProps } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { ReactElement } from "react";

export const LoadingSpinner = (props: LucideProps): ReactElement => (
  <Loader2 {...props} className={`animate-spin ${props.className || ""}`} />
);
