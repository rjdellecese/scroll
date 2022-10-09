import { InternalConvexClient } from "convex/browser";
import clientConfig from "~src/backend/_generated/clientConfig";

export const create = () =>
  new InternalConvexClient(clientConfig, (updatedQueries) =>
    console.log("updatedQueries", updatedQueries)
  );
