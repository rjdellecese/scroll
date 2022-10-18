import type {
  GenericAPI,
  MutationNames,
  NamedMutation,
  NamedQuery,
  QueryNames,
  QueryToken,
} from "convex/browser";
import { InternalConvexClient } from "convex/browser";
import { cmd } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import type { Sub } from "elm-ts/lib/Sub";
import { array, io, ioRef, map, option, string, task, taskOption } from "fp-ts";
import { flow, pipe } from "fp-ts/lib/function";
import { IO } from "fp-ts/lib/IO";
import type { IORef } from "fp-ts/lib/IORef";
import type { Option } from "fp-ts/lib/Option";
import { Task } from "fp-ts/lib/Task";
import { observable } from "fp-ts-rxjs";
import type { Observable } from "rxjs";
import * as rx from "rxjs";
import { BehaviorSubject, Subject } from "rxjs";
import {
  filter as rxFilter,
  finalize as rxFinalize,
  mergeMap as rxMergeMap,
} from "rxjs/operators";
import { match } from "ts-pattern";

import clientConfig from "~src/backend/_generated/clientConfig";
import * as cmdExtra from "~src/frontend/cmdExtra";

// TODO: Use functions from `fp-ts-rxjs` in place of `rxjs` when possible (check `rxjs/**/*` imports)

export type ElmTsConvexClient<API extends GenericAPI> = {
  readonly internalConvexClient: InternalConvexClient;
  readonly latestUpdatedQueryResults: BehaviorSubject<QueryToken[]>;
};

export const init = <API extends GenericAPI>(): ElmTsConvexClient<API> => {
  const latestUpdatedQueryResults = new BehaviorSubject<QueryToken[]>([]);

  return {
    internalConvexClient: new InternalConvexClient(
      clientConfig,
      (updatedWatchedQueries: QueryToken[]) => {
        console.log("updatedQueryTokens", updatedWatchedQueries);
        latestUpdatedQueryResults.next(updatedWatchedQueries);
      }
    ),
    latestUpdatedQueryResults,
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
  const latestQueryResultSubject = new Subject<
    Option<ReturnType<NamedQuery<API, Name>>>
  >();

  const { queryToken, unsubscribe } =
    elmTsConvexClient.internalConvexClient.subscribe(name, args);

  const latestQueryResultObservable: Observable<
    Option<ReturnType<NamedQuery<API, Name>>>
  > = elmTsConvexClient.latestUpdatedQueryResults.pipe(
    rxFilter((updatedQueryTokens) =>
      array.exists((updatedQueryToken: QueryToken) =>
        string.Eq.equals(queryToken, updatedQueryToken)
      )(updatedQueryTokens)
    ),
    rxMergeMap((updatedQueryTokens: QueryToken[]) =>
      match<boolean, Observable<Option<ReturnType<NamedQuery<API, Name>>>>>(
        array.isEmpty(updatedQueryTokens)
      )
        .with(true, () => rx.EMPTY)
        .with(
          false,
          (): Observable<Option<ReturnType<NamedQuery<API, Name>>>> =>
            pipe(
              elmTsConvexClient.internalConvexClient.localQueryResult(
                name,
                args
              ) as ReturnType<NamedQuery<API, Name>> | undefined,
              option.fromNullable,
              (optionLatestQueryResult) => rx.of(optionLatestQueryResult)
            )
        )
        .exhaustive()
    )
  );

  const latestQueryResultSubscription = latestQueryResultObservable.subscribe(
    latestQueryResultSubject
  );

  return latestQueryResultSubject.asObservable().pipe(
    rxMergeMap(
      option.match(
        () => rx.EMPTY,
        (result) => pipe(result, onResultChange, observable.of)
      )
    ),
    rxFinalize(() => {
      latestQueryResultSubscription.unsubscribe();
      unsubscribe();
    })
  );
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
