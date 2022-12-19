import type { GenericAPI, MutationNames, NamedMutation } from "convex/browser";
import type { ReactMutation } from "convex/react";
import type { Cmd } from "elm-ts/lib/Cmd";
import { task } from "fp-ts";
import { pipe } from "fp-ts/function";
import type { Option } from "fp-ts/lib/Option";
import * as rxjs from "rxjs";

export const runMutation: <
  API extends GenericAPI,
  Name extends MutationNames<API>,
  Msg
>(
  reactMutation: ReactMutation<API, Name>,
  onResponse: (response: ReturnType<NamedMutation<API, Name>>) => Option<Msg>,
  ...args: Parameters<NamedMutation<API, Name>>
) => Cmd<Msg> = (reactMutation, onResponse, ...args) =>
  pipe(
    () => reactMutation(...args),
    task.map(onResponse),
    (taskOption) => rxjs.of(taskOption)
  );
