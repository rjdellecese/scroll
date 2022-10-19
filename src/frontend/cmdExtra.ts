/* eslint-disable rxjs/finnish */
import { cmd } from "elm-ts";
import type { Cmd } from "elm-ts/lib/Cmd";
import { option, taskOption } from "fp-ts";
import type { Applicative1 } from "fp-ts/Applicative";
import type { Apply1 } from "fp-ts/Apply";
import { apFirst as apFirst_ } from "fp-ts/Apply";
import type { FromIO1 } from "fp-ts/FromIO";
import { constant, flow, identity, pipe, untupled } from "fp-ts/function";
import type { Functor1 } from "fp-ts/Functor";
import type { IO } from "fp-ts/IO";
import type { Monad1 } from "fp-ts/Monad";
import type { Monoid } from "fp-ts/Monoid";
import type { Option } from "fp-ts/Option";
import type { Pointed1 } from "fp-ts/Pointed";
import { observable } from "fp-ts-rxjs";
import * as rxjs from "rxjs";
import { map as rxMap, mergeMap as rxMergeMap } from "rxjs/operators";

export const URI = "Cmd";

export type URI = typeof URI;

// NON-PIPEABLES

const _map: Functor1<URI>["map"] = (fa, f) => pipe(fa, map(f));

const _ap: Applicative1<URI>["ap"] = (f, fa) => pipe(fa, ap(f));

const _chain: Monad1<URI>["chain"] = (fa, f) => pipe(fa, chain(f));

// TYPECLASS MEMBERS

export const map: <A, B>(f: (a: A) => B) => (fa: Cmd<A>) => Cmd<B> =
  (f) => (fa) =>
    observable.map(taskOption.map(f))(fa);

export const ap: <A, B>(f: Cmd<(a: A) => B>) => (fa: Cmd<A>) => Cmd<B> =
  (f) => (fa) =>
    rxjs
      .combineLatest([f, fa])
      .pipe(rxMap(([f_, fa_]) => taskOption.ap(fa_)(f_)));

export const chain: <A, B>(f: (a: A) => Cmd<B>) => (fa: Cmd<A>) => Cmd<B> =
  (f) => (fa) => {
    return fa.pipe(
      rxMergeMap(
        flow(
          taskOption.match(constant(cmd.none), f),
          observable.fromTask,
          observable.flatten
        )
      )
    );
  };

// NATURAL TRANSFORMATIONS

export const fromIO: FromIO1<URI>["fromIO"] = flow(
  observable.fromIO,
  observable.map(taskOption.of)
);

// TYPECLASS INSTANCES

export function getMonoid<A>(): Monoid<Cmd<A>> {
  return {
    concat: untupled(cmd.batch),
    empty: cmd.none,
  };
}

declare module "fp-ts/lib/HKT" {
  interface URItoKind<A> {
    readonly Cmd: Cmd<A>;
  }
}

export const of: <A>(a: A) => Cmd<A> = flow(taskOption.of, observable.of);

export const Pointed: Pointed1<URI> = {
  URI: URI,
  of: of,
};

export const Functor: Functor1<URI> = {
  URI: URI,
  map: _map,
};

export const Apply: Apply1<URI> = {
  URI: URI,
  ap: _ap,
  map: _map,
};

export const Applicative: Applicative1<URI> = {
  URI: URI,
  ap: _ap,
  map: _map,
  of: of,
};

export const Monad: Monad1<URI> = {
  URI: URI,
  ap: _ap,
  map: _map,
  of: of,
  chain: _chain,
};

export const FromIO: FromIO1<URI> = {
  URI: URI,
  fromIO: fromIO,
};

// COMBINATORS

export const flatten: <A>(mma: Cmd<Cmd<A>>) => Cmd<A> = (mma) =>
  Monad.chain(mma, identity);

export const apFirst: <B>(second: Cmd<B>) => <A>(first: Cmd<A>) => Cmd<A> =
  apFirst_(Apply);

export const ignore: <A>(ma: Cmd<A>) => Cmd<never> = chain(constant(cmd.none));

// CONSTRUCTORS

export const fromOption: <A>(ma: Option<A>) => Cmd<A> = option.match(
  constant(cmd.none),
  cmd.of
);

// UTILS

export const fromIOVoid: (ioVoid: IO<void>) => Cmd<never> = flow(
  fromIO,
  ignore
);

// There is a difference, at least for RxJs version 6.x, betweeen setting the scheduler via the `observeOn` operator and setting it as an argument to an `Observable` constructor function. See the following for some more detail: https://indepth.dev/posts/1012/rxjs-applying-asyncscheduler-as-an-argument-vs-with-observeon-operator
export const scheduleForNextAnimationFrame: <A>(cmd: Cmd<A>) => Cmd<A> = (
  cmd
) =>
  pipe(
    rxjs.of(taskOption.of(null), rxjs.animationFrameScheduler),
    chain(() => cmd)
  );
