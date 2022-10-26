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
import { array, ioRef, map, option, string, task } from "fp-ts";
import { constVoid, flow, identity, pipe } from "fp-ts/lib/function";
import type { IORef } from "fp-ts/lib/IORef";
import type { Option } from "fp-ts/lib/Option";
import { observable } from "fp-ts-rxjs";
import { Observable, Subject } from "rxjs";
import { share as rxShare } from "rxjs/operators";
import { match, P } from "ts-pattern";

import clientConfig from "~src/backend/_generated/clientConfig";
import type { UniqueQuery } from "~src/frontend/uniqueQuery";
import * as uniqueQuery from "~src/frontend/uniqueQuery";

// TODO: Use functions from `fp-ts-rxjs` in place of `rxjs` when possible (check `rxjs/**/*` imports)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ElmTsConvexClient<API extends GenericAPI> = {
  readonly internalConvexClient: InternalConvexClient;
  readonly updatedQueries$: Subject<QueryToken[]>;
  readonly ioRefUniqueQueriesToQueryTokens: IORef<
    Map<UniqueQuery<API>, QueryToken>
  >;
  readonly ioRefQueryTokensToQueryResults: IORef<
    Map<QueryToken, Observable<ReturnType<NamedQuery<API, QueryNames<API>>>>>
  >; // TODO: QueryToken -> Observable<API> which are created with the rxjs share operator. When each of these multicasted subscribers unsubscribes, they should remove themselves from this map.
};

// TODO: Make this idempotent by memoization.
export const init = <API extends GenericAPI>(): ElmTsConvexClient<API> => {
  const updatedQueries$ = new Subject<QueryToken[]>();

  return {
    internalConvexClient: new InternalConvexClient(
      clientConfig,
      (updatedQueries: QueryToken[]) => {
        updatedQueries$.next(updatedQueries);
      }
    ),
    updatedQueries$: updatedQueries$,
    ioRefUniqueQueriesToQueryTokens: ioRef.newIORef(new Map())(),
    ioRefQueryTokensToQueryResults: ioRef.newIORef(new Map())(),
  };
};

export const watchQuery = <
  API extends GenericAPI,
  Name extends QueryNames<API>,
  Msg
>(
  elmTsConvexClient: ElmTsConvexClient<API>,
  onResultChange: (result: ReturnType<NamedQuery<API, Name>>) => Option<Msg>,
  name: Name,
  ...args: Parameters<NamedQuery<API, Name>>
): Sub<Msg> => {
  /* eslint-disable no-type-assertion/no-type-assertion */
  const uniqueQuery_ = uniqueQuery.fromNameAndArgs(name, args);

  return match<Option<Observable<ReturnType<NamedQuery<API, Name>>>>, Sub<Msg>>(
    pipe(
      elmTsConvexClient.ioRefUniqueQueriesToQueryTokens.read(),
      map.lookup(uniqueQuery.getEq())(uniqueQuery_),
      option.chain((queryToken) =>
        pipe(
          elmTsConvexClient.ioRefQueryTokensToQueryResults.read(),
          map.lookup(string.Eq)(queryToken)
        )
      )
    )
  )
    .with(
      { _tag: "Some", value: P.select() },
      observable.chain(
        flow(
          onResultChange,
          option.match(() => observable.zero<Msg>(), observable.of)
        )
      )
    )
    .with({ _tag: "None" }, () => {
      const queryResult$ = new Observable<ReturnType<NamedQuery<API, Name>>>(
        function (subscriber) {
          const { queryToken, unsubscribe } =
            elmTsConvexClient.internalConvexClient.subscribe(name, args);

          const queryResultSubscription =
            elmTsConvexClient.updatedQueries$.subscribe(
              (updatedQueryTokens: QueryToken[]) =>
                match<boolean, void>(
                  pipe(
                    updatedQueryTokens,
                    array.exists((updatedQueryToken: QueryToken) =>
                      string.Eq.equals(queryToken, updatedQueryToken)
                    )
                  )
                )
                  .with(false, () => constVoid)
                  .with(true, (): void =>
                    pipe(
                      elmTsConvexClient.internalConvexClient.localQueryResult(
                        name,
                        args
                      ) as ReturnType<NamedQuery<API, Name>> | undefined,
                      option.fromNullable,
                      option.match(constVoid, (result) =>
                        subscriber.next(result)
                      )
                    )
                  )
                  .exhaustive()
            );

          elmTsConvexClient.ioRefUniqueQueriesToQueryTokens.modify(
            map.upsertAt(uniqueQuery.getEq())(uniqueQuery_, queryToken)
          )();
          elmTsConvexClient.ioRefQueryTokensToQueryResults.modify(
            map.upsertAt(string.Eq)(queryToken, this)
          )();

          return () => {
            unsubscribe();
            queryResultSubscription.unsubscribe();

            elmTsConvexClient.ioRefUniqueQueriesToQueryTokens.modify(
              map.deleteAt(uniqueQuery.getEq())(uniqueQuery_)
            )();
            elmTsConvexClient.ioRefQueryTokensToQueryResults.modify(
              map.deleteAt(string.Eq)(queryToken)
            )();
          };
        }
      ).pipe(rxShare());

      return observable.map(identity)(queryResult$);
    })
    .exhaustive();
};

export const runMutation = <
  API extends GenericAPI,
  Name extends MutationNames<API>,
  Msg
>(
  elmTsConvexClient: ElmTsConvexClient<API>,
  onComplete: (result: ReturnType<NamedMutation<API, Name>>) => Option<Msg>,
  name: Name,
  ...args: Parameters<NamedMutation<API, Name>>
): Cmd<Msg> =>
  /* eslint-disable no-type-assertion/no-type-assertion */
  pipe(
    (): Promise<ReturnType<NamedMutation<API, Name>>> =>
      elmTsConvexClient.internalConvexClient.mutate(name, args) as Promise<
        ReturnType<NamedMutation<API, Name>>
      >,
    task.map(onComplete),
    observable.of
  );
