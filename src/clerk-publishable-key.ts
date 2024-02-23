import { match } from "ts-pattern";

import type { Stage } from "~src/elm-ts/stage";

export const fromStage = (stage: Stage): string =>
  match(stage)
    .with("Production", () => "pk_live_Y2xlcmsuc2Nyb2xsLmluayQ")
    .with(
      "Development",
      () => "pk_test_Y2xlcmsuY29uY2lzZS5lc2NhcmdvdC0xOC5sY2wuZGV2JA",
    )
    .exhaustive();
