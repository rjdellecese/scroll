import { option } from "fp-ts";
import type { Option } from "fp-ts/lib/Option";
import { match } from "ts-pattern";

export type Stage = "Production" | "Development";

export const fromNodeEnv = (nodeEnv: string | undefined): Option<Stage> =>
  match<string | undefined, Option<Stage>>(nodeEnv)
    .with("development", () => option.some("Development"))
    .with("production", () => option.some("Production"))
    .otherwise(() => option.none);
