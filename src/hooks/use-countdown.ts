"use client";

import { useEffect, useState } from "react";

export interface CountdownValue {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** True once the target time has passed. */
  expired: boolean;
}

const ZERO: CountdownValue = { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

function diff(target: number): CountdownValue {
  const ms = target - Date.now();
  if (ms <= 0) return ZERO;
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

/** Live countdown to a target ISO datetime string, ticking once per second. */
export function useCountdown(targetIso: string): CountdownValue {
  const target = new Date(targetIso).getTime();
  const [value, setValue] = useState<CountdownValue>(() => (Number.isNaN(target) ? ZERO : diff(target)));

  useEffect(() => {
    if (Number.isNaN(target)) return;
    setValue(diff(target));
    const interval = setInterval(() => setValue(diff(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  return value;
}
