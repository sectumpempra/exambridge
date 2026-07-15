import type { PresetFunction } from '../types';

export const TRIG_PRESETS: PresetFunction[] = [
  { name: '正弦函数 · sin(x)', description: '周期 2π，值域 [−1, 1]', expression: 'a sin(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: '余弦函数 · cos(x)', description: '偶函数，周期 2π', expression: 'a cos(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: '正切函数 · tan(x)', description: '周期 π，含竖直渐近线', expression: 'a tan(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: '正割函数 · sec(x)', description: 'cos(x) 的倒数', expression: 'a sec(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: '余割函数 · cosec(x)', description: 'sin(x) 的倒数', expression: 'a/sin(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: '余切函数 · cot(x)', description: 'tan(x) 的倒数，周期 π', expression: 'a cot(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '三角' },
  { name: '反正弦函数 · arcsin(x)', description: '定义域 [−1, 1]', expression: 'a asin(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-1', domainMax: '1', category: '反三角' },
  { name: '反余弦函数 · arccos(x)', description: '定义域 [−1, 1]', expression: 'a acos(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-1', domainMax: '1', category: '反三角' },
  { name: '反正切函数 · arctan(x)', description: '值域 (−π/2, π/2)', expression: 'a atan(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '反三角' },
];

export const ALGEBRA_PRESETS: PresetFunction[] = [
  { name: '一次函数', expression: 'ax+b', params: { a: 1, b: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '二次抛物线', expression: 'ax^2+bx+c', params: { a: 1, b: 0, c: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '指数增长', expression: 'a^(bx+c)+d', params: { a: 2, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '对数', expression: 'log(bx+c)/log(a)+d', params: { a: 10, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10', category: '代数' },
  { name: '双曲线', expression: 'a/(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '绝对值', expression: 'a abs(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '-10', domainMax: '10', category: '代数' },
  { name: '根号', expression: 'a sqrt(bx+c)+d', params: { a: 1, b: 1, c: 0, d: 0 }, mode: 'cartesian', domainMin: '0', domainMax: '10', category: '代数' },
];

export const POLAR_PRESETS: PresetFunction[] = [
  { name: '玫瑰线', expression: 'a sin(b theta)', params: { a: 1, b: 4 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '心形线', expression: 'a(1+cos(theta))', params: { a: 1 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '阿基米德', expression: 'a theta', params: { a: 0.5 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '对数螺旋', expression: 'a(1.1^theta)', params: { a: 0.5 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '双纽线', expression: 'a sqrt(cos(2 theta))', params: { a: 1 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
  { name: '圆', expression: 'a', params: { a: 2 }, mode: 'polar', domainMin: '0', domainMax: '4pi', category: '极坐标' },
];
