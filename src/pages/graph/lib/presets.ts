import type { PresetFunction } from '../types';

export const TEACHER_PRESETS: PresetFunction[] = [
  { name: '一次函数', expression: 'a*x+b', params: { a: 1, b: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '二次函数', expression: 'a*x^2+b*x+c', params: { a: 1, b: 0, c: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '指数函数', expression: 'a^(b*x+c)+d', params: { a: 2, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '对数函数', expression: 'log(b*x+c)/log(a)+d', params: { a: 10, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10', category: '代数' },
  { name: 'sin(x)', expression: 'a*sin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'cos(x)', expression: 'a*cos(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'tan(x)', expression: 'a*tan(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
];

export const TRIG_PRESETS: PresetFunction[] = [
  { name: 'sin', expression: 'a*sin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'cos', expression: 'a*cos(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'tan', expression: 'a*tan(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'sec', expression: 'a*sec(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'csc', expression: 'a/sin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'cot', expression: 'a*cot(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: 'arcsin', expression: 'a*asin(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-1', domainMax: '1', category: '三角' },
  { name: 'arccos', expression: 'a*acos(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-1', domainMax: '1', category: '三角' },
  { name: 'arctan', expression: 'a*atan(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
];

export const ALGEBRA_PRESETS: PresetFunction[] = [
  { name: '一次函数', expression: 'a*x+b', params: { a: 1, b: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '二次抛物线', expression: 'a*x^2+b*x+c', params: { a: 1, b: 0, c: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '指数增长', expression: 'a^(b*x+c)+d', params: { a: 2, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '对数', expression: 'log(b*x+c)/log(a)+d', params: { a: 10, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10', category: '代数' },
  { name: '双曲线', expression: 'a/(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '绝对值', expression: 'a*abs(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '根号', expression: 'a*sqrt(b*x+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10', category: '代数' },
];

export const POLAR_PRESETS: PresetFunction[] = [
  { name: '玫瑰线', expression: 'a*sin(b*theta)', params: { a: 1, b: 4 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '心形线', expression: 'a*(1+cos(theta))', params: { a: 1 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '阿基米德', expression: 'a*theta', params: { a: 0.5 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '对数螺旋', expression: 'a*(1.1^theta)', params: { a: 0.5 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '双纽线', expression: 'a*sqrt(cos(2*theta))', params: { a: 1 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '圆', expression: 'a', params: { a: 2 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
];
