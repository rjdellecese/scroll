import type {
  GenericAPI,
  MutationNames,
  NamedMutation,
  NamedQuery,
  QueryNames,
  QueryToken,
} from "convex/browser";
import { InternalConvexClient } from "convex/browser";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Sub } from "elm-ts/lib/Sub";
import { array, option, string, taskOption } from "fp-ts";
import { pipe } from "fp-ts/lib/function";
import { observable } from "fp-ts-rxjs";
import * as rx from "rxjs";
import { Subject } from "rxjs";
import { finalize as rxFinalize } from "rxjs/operators";
import { match } from "ts-pattern";

import clientConfig from "~src/backend/_generated/clientConfig";
import * as cmdExtra from "~src/frontend/cmdExtra";

// TODO: Use functions from `fp-ts-rxjs` in place of `rxjs` when possible (check `rxjs/**/*` imports)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ElmTsConvexClient<API extends GenericAPI> = {
  readonly internalConvexClient: InternalConvexClient;
  readonly latestUpdatedQueryResults$: Subject<QueryToken[]>;
};

export const init = <API extends GenericAPI>(): ElmTsConvexClient<API> => {
  const latestUpdatedQueryResults$ = new Subject<QueryToken[]>();

  return {
    internalConvexClient: new InternalConvexClient(
      clientConfig,
      (updatedWatchedQueries: QueryToken[]) => {
        latestUpdatedQueryResults$.next(updatedWatchedQueries);
      }
    ),
    latestUpdatedQueryResults$: latestUpdatedQueryResults$,
  };
};

export const watchQuery = <
  API extends GenericAPI,
  Name extends QueryNames<API>,
  Msg
>(
  elmTsConvexClient: ElmTsConvexClient<API>,
  onResultChange: (result: ReturnType<NamedQuery<API, Name>>) => Msg,
  name: Name,
  ...args: Parameters<NamedQuery<API, Name>>
): Sub<Msg> => {
  /* eslint-disable no-type-assertion/no-type-assertion */
  const { queryToken, unsubscribe } =
    elmTsConvexClient.internalConvexClient.subscribe(name, args);

  return pipe(
    elmTsConvexClient.latestUpdatedQueryResults$,
    observable.filter((updatedQueryTokens) =>
      array.exists((updatedQueryToken: QueryToken) =>
        string.Eq.equals(queryToken, updatedQueryToken)
      )(updatedQueryTokens)
    ),
    observable.chain((updatedQueryTokens: QueryToken[]) =>
      match<boolean, Sub<Msg>>(array.isEmpty(updatedQueryTokens))
        .with(true, () => observable.getMonoid().empty)
        .with(
          false,
          (): Sub<Msg> =>
            pipe(
              elmTsConvexClient.internalConvexClient.localQueryResult(
                name,
                args
              ) as ReturnType<NamedQuery<API, Name>> | undefined,
              option.fromNullable,
              option.match(
                () => rx.EMPTY,
                (result) => pipe(result, onResultChange, observable.of)
              )
            )
        )
        .exhaustive()
    )
  ).pipe(rxFinalize(unsubscribe));
};

export const runMutation = <
  API extends GenericAPI,
  Name extends MutationNames<API>,
  Msg
>(
  elmTsConvexClient: ElmTsConvexClient<API>,
  onComplete: (result: ReturnType<NamedMutation<API, Name>>) => Msg,
  name: Name,
  ...args: Parameters<NamedMutation<API, Name>>
): Cmd<Msg> =>
  /* eslint-disable no-type-assertion/no-type-assertion */
  pipe(
    (): Promise<ReturnType<NamedMutation<API, Name>>> =>
      elmTsConvexClient.internalConvexClient.mutate(name, args) as Promise<
        ReturnType<NamedMutation<API, Name>>
      >,
    taskOption.fromTask,
    observable.of,
    cmdExtra.map(onComplete)
  );
