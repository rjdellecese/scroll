import type { Sub } from "elm-ts/lib/Sub";
import { array, io, ioRef } from "fp-ts";
import { apply, constVoid, pipe } from "fp-ts/function";
import type { IO } from "fp-ts/IO";
import type { IORef } from "fp-ts/IORef";
import type { Subscriber } from "rxjs";
import { Observable } from "rxjs";

export type CallbackManager<Msg> = {
  subscribe: (onSubscribe: Callback<Msg>) => IO<void>;
  unsubscribe: (onUnsubscribe: Callback<Msg>) => IO<void>;
};

export type Callback<Msg> = (msg: Msg) => IO<void>;

export type CallbackInterop<Msg> = {
  dispatch: (msg: Msg) => IO<void>;
  callbackManager: CallbackManager<Msg>;
};

type Callbacks<Msg> = IORef<Callback<Msg>[]>;

export const subscriptions: <Msg>(
  callbackManager: CallbackManager<Msg>
) => Sub<Msg> = <Msg>(callbackManager: CallbackManager<Msg>) => {
  return new Observable((subscriber: Subscriber<Msg>) => {
    const handle: (msg: Msg) => IO<void> = (msg) => () => subscriber.next(msg);

    callbackManager.subscribe(handle)();

    return function unsubscribe() {
      callbackManager.unsubscribe(handle)();
    };
  });
};

export const manageCallbacks: <Msg>() => IO<CallbackInterop<Msg>> = <Msg>() =>
  pipe(
    ioRef.newIORef<Callback<Msg>[]>([]),
    io.chain((callbacks) => () => ({
      dispatch: dispatch(callbacks),
      callbackManager: {
        subscribe: subscribe(callbacks),
        unsubscribe: unsubscribe(callbacks),
      },
    }))
  );

const dispatch: <Msg>(callbacks: Callbacks<Msg>) => (msg: Msg) => IO<void> =
  (callbacks) => (msg) =>
    pipe(
      callbacks.read,
      io.chain(io.traverseArray(apply(msg))),
      io.map(constVoid)
    );

const subscribe: <Msg>(
  callbacks: Callbacks<Msg>
) => (callback: Callback<Msg>) => IO<void> = (callbacks) => (callback) =>
  callbacks.modify(array.append(callback));

const unsubscribe: <Msg>(
  callbacks: Callbacks<Msg>
) => (callback: Callback<Msg>) => IO<void> = (callbacks) => (callback) =>
  // Reference equality check
  callbacks.modify(array.filter((callback_) => callback_ !== callback));
