import type { Sub } from "elm-ts/lib/Sub";
import { array, io, ioRef } from "fp-ts";
import { apply, constVoid, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/IO";
import type { IORef } from "fp-ts/IORef";
import * as rxjs from "rxjs";

export type SubscriptionManager<Msg> = {
  subscribe: (callback: SubscriptionCallback<Msg>) => IO<void>;
  unsubscribe: (callback: SubscriptionCallback<Msg>) => IO<void>;
};

export type SubscriptionCallback<Msg> = (msg: Msg) => IO<void>;

export type SubscriptionInterop<Msg> = {
  dispatch: (msg: Msg) => IO<void>;
  subscriptionManager: SubscriptionManager<Msg>;
};

type Subscriptions<Msg> = IORef<SubscriptionCallback<Msg>[]>;

export const subscriptions: <Msg>(
  subscriptionManager: SubscriptionManager<Msg>
) => Sub<Msg> = <Msg>(subscriptionManager: SubscriptionManager<Msg>) => {
  return new rxjs.Observable((subscriber: rxjs.Subscriber<Msg>) => {
    const handle: (msg: Msg) => IO<void> = (msg) => () => subscriber.next(msg);

    subscriptionManager.subscribe(handle)();

    return function unsubscribe() {
      subscriptionManager.unsubscribe(handle)();
    };
  });
};

export const manageSubscriptions: <Msg>() => IO<SubscriptionInterop<Msg>> = <
  Msg
>() =>
  pipe(
    ioRef.newIORef<SubscriptionCallback<Msg>[]>([]),
    io.chain((subscriptions) => () => ({
      dispatch: dispatch(subscriptions),
      subscriptionManager: {
        subscribe: subscribe(subscriptions),
        unsubscribe: unsubscribe(subscriptions),
      },
    }))
  );

const dispatch: <Msg>(
  subscriptions: Subscriptions<Msg>
) => (msg: Msg) => IO<void> = (subscriptions) => (msg) =>
  pipe(
    subscriptions.read,
    io.chain(io.traverseArray(apply(msg))),
    io.map(constVoid)
  );

const subscribe: <Msg>(
  subscriptions: Subscriptions<Msg>
) => (callback: SubscriptionCallback<Msg>) => IO<void> =
  (subscriptions) => (callback) =>
    subscriptions.modify(array.prepend(callback));

const unsubscribe: <Msg>(
  subscriptions: Subscriptions<Msg>
) => (callback: SubscriptionCallback<Msg>) => IO<void> =
  (subscriptions) => (callback) =>
    // Reference equality check
    subscriptions.modify(array.filter((callback_) => callback_ !== callback));
