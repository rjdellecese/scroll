import { InternalConvexClient } from "convex/browser";
import type { IO } from "fp-ts/lib/IO";

import clientConfig from "~src/backend/_generated/clientConfig";

export const create: IO<InternalConvexClient> = () =>
  new InternalConvexClient(clientConfig, (updatedQueries) =>
    console.log("updatedQueries", updatedQueries)
  );
