// ==== Subscript digits/letters for log bases ====
const SUB_DIGIT: Record<string, string> = {
  '0': '\u2080', '1': '\u2081', '2': '\u2082', '3': '\u2083', '4': '\u2084',
  '5': '\u2085', '6': '\u2086', '7': '\u2087', '8': '\u2088', '9': '\u2089',
  '.': '\u002E', 'e': '\u2091', 'a': '\u2090', 'o': '\u2092',
  'x': '\u2093', 'h': '\u2095', 'k': '\u2096', 'l': '\u2097',
  'm': '\u2098', 'n': '\u2099', 'p': '\u209A', 's': '\u209B',
};

// ==== Superscript digits/letters for exponents ====
const SUP: Record<string, string> = {
  '0': '\u2070', '1': '\u00B9', '2': '\u00B2', '3': '\u00B3', '4': '\u2074',
  '5': '\u2075', '6': '\u2076', '7': '\u2077', '8': '\u2078', '9': '\u2079',
  '-': '\u207B',
  'x': '\u02E3', 'n': '\u207F', 'a': '\u1D43', 'b': '\u1D47', 'c': '\u1D9C',
  'd': '\u1D48', 'e': '\u1D49', 'f': '\u1DA0', 'g': '\u1D4D', 'h': '\u02B0',
  'i': '\u2071', 'j': '\u02B2', 'k': '\u1D4F', 'l': '\u02E1', 'm': '\u1D50',
  'o': '\u1D52', 'p': '\u1D56', 'r': '\u02B3', 's': '\u02E2', 't': '\u1D57',
  'u': '\u1D58', 'v': '\u1D5B', 'w': '\u02B7', 'y': '\u02B8', 'z': '\u1DBB',
};

function toSuperscript(str: string): string {
  return str.split('').map(ch => SUP[ch] ?? ch).join('');
}

function toSubscript(str: string): string {
  return str.split('').map(ch => SUB_DIGIT[ch] ?? ch).join('');
}

const PROTECTED_IDENTIFIERS = [
  'factorial', 'arcsinh', 'arccosh', 'arctanh', 'atan2',
  'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
  'arcsin', 'arccos', 'arctan', 'asin', 'acos', 'atan',
  'log10', 'log2', 'sqrt', 'cbrt', 'round', 'floor', 'ceil',
  'cosec', 'sin', 'cos', 'tan', 'sec', 'csc', 'cot', 'abs',
  'exp', 'pow', 'max', 'min', 'sign', 'theta', 'pi',
].sort((a, b) => b.length - a.length);

function formatParamValue(value: number): string {
  if (Math.abs(value) >= 100 || (Math.abs(value) < 0.001 && value !== 0)) {
    return value.toExponential(1);
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Replace parameters even when they use implicit multiplication (`bx`, `ax`).
 * Function names are consumed first so a parameter called `a` never changes
 * `asin`, `abs`, `max`, and similar built-ins.
 */
function substituteParamTokens(expression: string, params: Record<string, number>): string {
  if (!params || Object.keys(params).length === 0) return expression;
  const paramNames = Object.keys(params).sort((a, b) => b.length - a.length);
  let result = '';
  let index = 0;

  while (index < expression.length) {
    const protectedName = PROTECTED_IDENTIFIERS.find((name) => expression.startsWith(name, index));
    if (protectedName) {
      result += protectedName;
      index += protectedName.length;
      continue;
    }

    const paramName = paramNames.find((name) => expression.startsWith(name, index));
    if (paramName) {
      result += formatParamValue(params[paramName]);
      index += paramName.length;
      continue;
    }

    result += expression[index];
    index += 1;
  }

  return result;
}

/**
 * Substitute parameter values into the expression.
 */
export function substituteParams(expression: string, params: Record<string, number>): string {
  return substituteParamTokens(expression, params);
}

/**
 * Format expression for beautiful UI display:
 * 1. Substitute parameter values
 * 2. abs(...) → |...|
 * 3. Remove asterisks
 * 4. Convert exponents ^n to superscript
 * 5. Convert log(x)/log(N) to logₙ(x)
 * 6. theta → θ, sqrt → √, pi → π
 * 7. Fix +- → -
 */
export function displayWithParams(expression: string, params: Record<string, number>): string {
  // Step 1: Substitute parameter values
  let s = substituteParams(expression, params);

  // Step 2: Convert abs(...) to |...|
  while (s.includes('abs(')) {
    s = s.replace(/abs\(([^()]+)\)/g, '|$1|');
    s = s.replace(/abs\(([^()]*\([^()]*\)[^()]*)\)/g, '|$1|');
  }

  // Step 3: Reciprocal trig must be converted before slash cleanup.
  s = s.replace(/([a-zA-Z]|\d+\.?\d*)\/sin\(/g, '$1cosec(');
  s = s.replace(/([a-zA-Z]|\d+\.?\d*)\/cos\(/g, '$1sec(');
  s = s.replace(/([a-zA-Z]|\d+\.?\d*)\/tan\(/g, '$1cot(');

  // Step 4: Simplify zero offsets and zero terms until stable.
  let previous: string;
  do {
    previous = s;
    s = s.replace(/\+0x(?=[+\-)]|$)/g, '');
    s = s.replace(/-0x(?=[+\-)]|$)/g, '');
    s = s.replace(/\+0(?=[+\-)|]|$)/g, '');
    s = s.replace(/-0(?=[+\-)|]|$)/g, '');
    s = s.replace(/(^|\()0\+/g, '$1');
    s = s.replace(/\+0\)/g, ')');
    s = s.replace(/-0\)/g, ')');
    s = s.replace(/\+\+/g, '+').replace(/\+-/g, '-').replace(/--/g, '+').replace(/-\+/g, '-');
  } while (s !== previous);

  // Step 5: Simplify identity coefficients for explicit and implicit multiplication.
  s = s.replace(/(^|[^0-9.])1\*(?=[a-zA-Z(])/g, '$1');   // 1* → remove
  s = s.replace(/(^|[^0-9.])-1\*(?=[a-zA-Z(])/g, '$1-');  // -1* → -
  s = s.replace(/(^|[+\-(])1\s*(?=(?:sin|cos|tan|sec|cosec|csc|cot|asin|acos|atan|abs|sqrt)\b|\(|\|)/g, '$1');
  s = s.replace(/(^|[^0-9.])1(?=x(?:\^|[+\-)|]|$))/g, '$1');

  // Step 6: Convert log(x)/log(N) to logₙ(x)
  s = s.replace(/log\(([^)]+)\)\s*\/\s*log\(([^)]+)\)/g, (_, inner, base) => {
    return `log${toSubscript(base)}(${inner})`;
  });

  // Step 7: Remove all asterisks
  s = s.replace(/\*/g, '');

  // Step 8: Convert simple exponents to superscript.
  s = s.replace(/\^\((x|n|-?\d+)\)/g, (_, inner) => toSuperscript(inner));
  s = s.replace(/\^(x|n|-?\d+)/g, (_, exp) => toSuperscript(exp));

  // Step 9: Replace math symbols and use textbook-style uppercase axes.
  s = s.replace(/asin/g, 'arcsin').replace(/acos/g, 'arccos').replace(/atan/g, 'arctan');
  s = s.replace(/theta/g, '\u03B8');
  s = s.replace(/sqrt\(([^()]+)\)/g, '\u221A$1');
  s = s.replace(/sqrt/g, '\u221A');
  s = s.replace(/\bpi\b/g, '\u03C0');
  s = s.replace(/(?<![a-zA-Z])x(?![a-zA-Z])/g, 'X');

  // Step 10: Remove redundant parentheses for a single axis variable.
  s = s.replace(/\b(sin|cos|tan|sec|cosec|csc|cot|arcsin|arccos|arctan)\((X|\u03B8)\)/g, '$1 $2');
  s = s.replace(/(log[\u2080-\u2089\u208B.]+)\(X\)/g, '$1 X');
  s = s.replace(/\|X\|/g, '|X|');
  s = s.replace(/\((X|\u03B8)\)/g, '$1');

  // Remove one redundant outer group, while preserving multiplication groups.
  if (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let wrapsWholeExpression = true;
    for (let i = 0; i < s.length; i += 1) {
      if (s[i] === '(') depth += 1;
      if (s[i] === ')') depth -= 1;
      if (depth === 0 && i < s.length - 1) {
        wrapsWholeExpression = false;
        break;
      }
    }
    if (wrapsWholeExpression) s = s.slice(1, -1);
  }

  // Step 11: Normalize visual spacing.
  s = s.replace(/\s*([+\-/])\s*/g, '$1');
  s = s.replace(/(\d)\s+(?=[X\u03B8])/g, '$1');
  s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Simple display without param substitution.
 */
export function displayExpression(expr: string): string {
  if (!expr) return expr;
  let s = expr;
  while (s.includes('abs(')) {
    s = s.replace(/abs\(([^()]+)\)/g, '|$1|');
    s = s.replace(/abs\(([^()]*\([^()]*\)[^()]*)\)/g, '|$1|');
  }
  // Log base subscript
  s = s.replace(/log\(([^)]+)\)\s*\/\s*log\(([^)]+)\)/g, (_, inner, base) => `log${toSubscript(base)}(${inner})`);
  s = s.replace(/\*/g, '');
  s = s.replace(/\^\(([^)]+)\)/g, (_, inner) => '^(' + toSuperscript(inner) + ')');
  s = s.replace(/\^([a-zA-Z0-9-]+)/g, (_, exp) => toSuperscript(exp));
  s = s.replace(/theta/g, '\u03B8');
  s = s.replace(/sqrt/g, '\u221A');
  s = s.replace(/\bpi\b/g, '\u03C0');
  return s;
}

/**
 * Canvas label with param substitution.
 */
export function labelExpression(expression: string, mode: 'cartesian' | 'polar', params: Record<string, number>): string {
  const prefix = mode === 'polar' ? 'R = ' : 'Y = ';
  return prefix + displayWithParams(expression, params);
}

/**
 * Domain variable label.
 */
export function domainVariable(mode: 'cartesian' | 'polar'): string {
  return mode === 'polar' ? '\u03B8' : 'x';
}
