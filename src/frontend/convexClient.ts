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
import { array, ioRef, map, option, string } from "fp-ts";
import { flow, hole, pipe } from "fp-ts/lib/function";
import type { IORef } from "fp-ts/lib/IORef";
import type { Option } from "fp-ts/lib/Option";
import type { Observable } from "rxjs";
import * as rx from "rxjs";
import { BehaviorSubject } from "rxjs";
import {
  filter as rxFilter,
  finalize as rxFinalize,
  mergeMap as rxMergeMap,
} from "rxjs/operators";
import { match } from "ts-pattern";

import clientConfig from "~src/backend/_generated/clientConfig";

type ElmTsConvexClient<API extends GenericAPI, Name extends QueryNames<API>> = {
  readonly internalConvexClient: InternalConvexClient;
  readonly latestUpdatedQueryResults: BehaviorSubject<QueryToken[]>;
  readonly ioRefWatchedQueryResults: IORef<WatchedQueryResults<API, Name>>;
};

type WatchedQueryResults<
  API extends GenericAPI,
  Name extends QueryNames<API>
> = Map<QueryToken, BehaviorSubject<Option<ReturnType<NamedQuery<API, Name>>>>>;

export const create = <
  API extends GenericAPI,
  Name extends QueryNames<API>
>(): ElmTsConvexClient<API, Name> => {
  const latestUpdatedQueryResults = new BehaviorSubject<QueryToken[]>([]);

  return {
    internalConvexClient: new InternalConvexClient(
      clientConfig,
      (updatedWatchedQueries: QueryToken[]) => {
        latestUpdatedQueryResults.next(updatedWatchedQueries);
      }
    ),
    latestUpdatedQueryResults,
    ioRefWatchedQueryResults: ioRef.newIORef(new Map())(),
  };
};

export const watchQuery = <
  API extends GenericAPI,
  Name extends QueryNames<API>,
  Msg
>(
  elmTsConvexClient: ElmTsConvexClient<API, Name>,
  latestUpdatedQueryResults: BehaviorSubject<QueryToken[]>,
  onResultChange: (result: ReturnType<NamedQuery<API, Name>>) => Msg,
  name: Name,
  ...args: Parameters<NamedQuery<API, Name>>
): Sub<Msg> => {
  const latestQueryResultBehaviorSubject = new BehaviorSubject<
    Option<ReturnType<NamedQuery<API, Name>>>
  >(option.none);

  const { queryToken, unsubscribe } =
    elmTsConvexClient.internalConvexClient.subscribe(name, args);

  const latestQueryResultObservable: Observable<
    Option<ReturnType<NamedQuery<API, Name>>>
  > = latestUpdatedQueryResults.pipe(
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
    ),
    rxFinalize(unsubscribe)
  );

  latestQueryResultObservable.subscribe(latestQueryResultBehaviorSubject);

  elmTsConvexClient.ioRefWatchedQueryResults.modify((watchedQueryResults) =>
    map.upsertAt(string.Eq)(queryToken, latestQueryResultBehaviorSubject)(
      watchedQueryResults
    )
  )();

  return latestQueryResultBehaviorSubject.asObservable().pipe(
    rxMergeMap(
      option.match(
        () => rx.EMPTY,
        flow(onResultChange, (msg) => rx.of(msg))
      )
    )
  );
};

export const runMutation: <
  API extends GenericAPI,
  Name extends MutationNames<API>,
  Msg
>(
  elmTsConvexClient: ElmTsConvexClient<API, Name>,
  onComplete: (result: ReturnType<NamedMutation<API, Name>>) => Msg,
  name: Name,
  ...args: Parameters<NamedMutation<API, Name>>
) => Cmd<Msg> = hole(); // TODO: Implement
