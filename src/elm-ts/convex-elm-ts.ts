import type { ConvexReactClient } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { Cmd } from "elm-ts/lib/Cmd";
import { task } from "fp-ts";
import { pipe } from "fp-ts/function";
import type { Option } from "fp-ts/lib/Option";
import * as rxjs from "rxjs";

export const runMutation: <
  FunRef extends FunctionReference<"mutation", "public">,
  Msg,
>(
  convex: ConvexReactClient,
  funRef: FunRef,
  onResponse: (response: FunctionReturnType<FunRef>) => Option<Msg>,
  args: FunctionArgs<FunRef>,
) => Cmd<Msg> = (convex, funRef, onResponse, args) =>
  pipe(
    () => convex.mutation(funRef, args),
    task.map(onResponse),
    (taskOption) => rxjs.of(taskOption),
  );
