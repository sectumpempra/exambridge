import { describe, expect, it } from 'vitest';
import {
  compileExpression,
  convertNumbersToParams,
  convertNumbersWithExisting,
  evaluateCartesian,
  formatImplicitMultiplication,
  preprocessExpression,
} from '../src/pages/graph/lib/graphRenderer';
import { simplifyZeroAdditiveParams } from '../src/pages/graph/components/EditableExpression';
import { labelExpression } from '../src/pages/graph/lib/displayUtils';
import { ALGEBRA_PRESETS, POLAR_PRESETS, TRIG_PRESETS } from '../src/pages/graph/lib/presets';

describe('graph implicit multiplication', () => {
  it.each([
    ['2x', 2],
    ['3 sin(2x)', 3 * Math.sin(2)],
    ['(x+1)(x-1)', 8],
    ['2 pi x', 2 * Math.PI],
  ])('compiles %s', (expression, expected) => {
    const compiled = compileExpression(expression);
    expect(compiled).not.toBeNull();
    expect(evaluateCartesian(compiled!, expression.includes('(x+1)') ? 3 : 1, {})).toBeCloseTo(expected);
  });

  it('converts numeric coefficients without exposing explicit multiplication', () => {
    const converted = convertNumbersToParams('3 sin(2x)');
    expect(converted).toEqual({ expression: 'a sin(bx)', params: { a: 3, b: 2 } });
    expect(converted?.expression).not.toContain('*');
  });

  it('keeps existing parameters and implicit multiplication', () => {
    const converted = convertNumbersWithExisting('2 cos(3x)+c', ['c']);
    expect(converted).toEqual({ expression: 'a cos(bx)+c', params: { a: 2, b: 3 } });
    expect(preprocessExpression(converted!.expression)).toBe('a*cos(b*x)+c');
  });

  it('formats protected names with a safe visual boundary', () => {
    expect(formatImplicitMultiplication('a*sin(b*x)+2*pi*x')).toBe('a sin(bx)+2 pi x');
  });
});

describe('graph expression display', () => {
  it.each([
    ['a sin(bx+c)+d', { a: 1, b: 1, c: 0, d: 0 }, 'Y = sin X'],
    ['a cos(bx+c)+d', { a: 1, b: 1, c: 0, d: 0 }, 'Y = cos X'],
    ['a tan(bx+c)+d', { a: 2, b: 3, c: 0, d: 0 }, 'Y = 2 tan(3X)'],
    ['a/sin(bx+c)+d', { a: 1, b: 1, c: 0, d: 0 }, 'Y = cosec X'],
    ['ax+b', { a: 1, b: 0 }, 'Y = X'],
    ['ax^2+bx+c', { a: 1, b: 0, c: 0 }, 'Y = X²'],
    ['a abs(bx+c)+d', { a: 1, b: 1, c: 0, d: 0 }, 'Y = |X|'],
    ['a sqrt(bx+c)+d', { a: 1, b: 1, c: 0, d: 0 }, 'Y = √X'],
  ])('formats %s as a clean canvas label', (expression, params, expected) => {
    expect(labelExpression(expression, 'cartesian', params)).toBe(expected);
  });

  it('formats polar labels with the same simplification rules', () => {
    expect(labelExpression('a sin(b theta)', 'polar', { a: 1, b: 4 })).toBe('R = sin(4θ)');
    expect(labelExpression('a(1+cos(theta))', 'polar', { a: 1 })).toBe('R = 1+cos θ');
    expect(labelExpression('a(1.1^theta)', 'polar', { a: 0.5 })).toBe('R = 0.5(1.1^θ)');
  });

  it('hides additive zero parameters and restores non-zero terms', () => {
    expect(
      simplifyZeroAdditiveParams('a sin(bx+c)+d', { a: 1, b: 1, c: 0, d: 0 })
    ).toBe('a sin(bx)');
    expect(
      simplifyZeroAdditiveParams('a sin(bx+c)+d', { a: 1, b: 1, c: 0.5, d: 0 })
    ).toBe('a sin(bx+c)');
    expect(
      simplifyZeroAdditiveParams('ax^2+bx+c', { a: 1, b: 0, c: 0 })
    ).toBe('ax^2+bx');
  });

  it('does not hide a zero parameter used as a coefficient', () => {
    expect(simplifyZeroAdditiveParams('ax+b', { a: 0, b: 1 })).toBe('ax+b');
  });
});

describe('graph presets', () => {
  it('keeps the three requested preset groups with descriptive trig labels', () => {
    expect(ALGEBRA_PRESETS.length).toBeGreaterThan(0);
    expect(POLAR_PRESETS.length).toBeGreaterThan(0);
    expect(TRIG_PRESETS).toHaveLength(9);
    expect(TRIG_PRESETS.every(preset => preset.name.includes('·') && preset.description)).toBe(true);
  });
});
