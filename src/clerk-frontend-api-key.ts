import { match } from "ts-pattern";

import type { Stage } from "~src/elm-ts/stage";

export const fromStage = (stage: Stage): string =>
  match(stage)
    .with("Production", () => "clerk.scroll.ink")
    .with("Development", () => "clerk.concise.escargot-18.lcl.dev")
    .exhaustive();
