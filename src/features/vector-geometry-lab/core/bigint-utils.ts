/**
 * Deterministic bigint primitives shared by the exact arithmetic layer.
 * No floating point anywhere in this file.
 */

export function bigintAbs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

export function bigintGcd(a: bigint, b: bigint): bigint {
  let x = bigintAbs(a);
  let y = bigintAbs(b);
  while (y !== 0n) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/** gcd of many values; gcd of an empty list is defined as 0. */
export function bigintGcdAll(values: readonly bigint[]): bigint {
  let acc = 0n;
  for (const value of values) {
    acc = bigintGcd(acc, value);
  }
  return acc;
}

export function bigintLcm(a: bigint, b: bigint): bigint {
  if (a === 0n || b === 0n) {
    return 0n;
  }
  return bigintAbs((a / bigintGcd(a, b)) * b);
}

/** lcm of many values; lcm of an empty list is defined as 1. */
export function bigintLcmAll(values: readonly bigint[]): bigint {
  let acc = 1n;
  for (const value of values) {
    acc = bigintLcm(acc, value);
  }
  return acc;
}

export function bigintMin(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

export function bigintMax(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * Floor of the integer square root via Newton's method with a bit-length
 * seed, so even 60+ digit inputs converge in a handful of iterations.
 */
export function integerSqrtFloor(n: bigint): bigint {
  if (n < 0n) {
    throw new RangeError("integerSqrtFloor requires a non-negative bigint");
  }
  if (n < 2n) {
    return n;
  }
  const bitLength = n.toString(2).length;
  let x = 1n << BigInt(Math.ceil(bitLength / 2));
  let y = (x + n / x) >> 1n;
  while (y < x) {
    x = y;
    y = (x + n / x) >> 1n;
  }
  return x;
}

/** Returns the exact root when `n` is a perfect square, otherwise undefined. */
export function perfectSquareRoot(n: bigint): bigint | undefined {
  if (n < 0n) {
    return undefined;
  }
  const root = integerSqrtFloor(n);
  return root * root === n ? root : undefined;
}
