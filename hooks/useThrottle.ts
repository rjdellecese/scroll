import { useEffect, useRef, useState } from "react";
import { option } from "fp-ts";
import { Option } from "fp-ts/lib/Option";
import { useTimeout } from "usehooks-ts";
import { constVoid } from "fp-ts/lib/function";

export const useThrottle = <T>(value: T, ms: number) => {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const nextValueRef = useRef<Option<T>>(option.none);

  const onTimeout = () => {
    console.log("nextValue", nextValueRef.current);

    option.match(constVoid, (nextValue: T) => setThrottledValue(nextValue))(
      nextValueRef.current
    );

    nextValueRef.current = option.none;
  };

  const setNextValueTimeout = () => useTimeout(onTimeout, 200);

  useEffect(() => {
    nextValueRef.current = option.some(value);

    option.match(() => {
      setNextValueTimeout();
    }, constVoid)(nextValueRef.current);
  }, [setNextValueTimeout, value]);

  return throttledValue;
};
