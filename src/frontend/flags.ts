import type { IO } from "fp-ts/lib/IO";

import type { ConvexAPI } from "~src/backend/_generated/react";
import type { ElmTsConvexClient } from "~src/frontend/elmTsConvexClient";
import * as elmTsConvexClient from "~src/frontend/elmTsConvexClient";

export type Flags = { convexClient: ElmTsConvexClient<ConvexAPI> };

export const init: IO<Flags> = () => ({
  convexClient: elmTsConvexClient.init(),
});
