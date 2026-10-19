'use strict';

/** @typedef {{ caseSensitive?: boolean, trim?: boolean, normalize?: (value: string) => string }} NormalizationOptions */

class CleanaryValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'CleanaryValidationError';
  }
}

function makeNormalizer(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new CleanaryValidationError('options must be an object');
  }
  if (options.caseSensitive !== undefined && typeof options.caseSensitive !== 'boolean') {
    throw new CleanaryValidationError('caseSensitive must be a boolean');
  }
  if (options.trim !== undefined && typeof options.trim !== 'boolean') {
    throw new CleanaryValidationError('trim must be a boolean');
  }
  if (options.normalize !== undefined && typeof options.normalize !== 'function') {
    throw new CleanaryValidationError('normalize must be a function');
  }
  return (value) => {
    if (typeof value !== 'string') throw new CleanaryValidationError('all rows must be strings');
    let key = options.trim ? value.trim() : value;
    if (options.caseSensitive === false) key = key.toLowerCase();
    if (options.normalize) key = options.normalize(key);
    if (typeof key !== 'string') throw new CleanaryValidationError('normalize must return a string');
    return key;
  };
}

function toLines(input) {
  if (!input || typeof input[Symbol.iterator] !== 'function' || typeof input === 'string') {
    throw new CleanaryValidationError('lines must be an iterable of strings');
  }
  const lines = Array.from(input);
  for (const value of lines) {
    if (typeof value !== 'string') throw new CleanaryValidationError('all rows must be strings');
  }
  return lines;
}

function inspectLines(input, options = {}) {
  const lines = toLines(input);
  const normalize = makeNormalizer(options);
  const groups = new Map();
  const keys = [];
  for (let i = 0; i < lines.length; i++) {
    const key = normalize(lines[i]);
    keys.push(key);
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { value: lines[i], count: 1, firstLine: i + 1 });
  }
  const duplicates = [...groups.values()].filter((group) => group.count > 1)
    .sort((a, b) => b.count - a.count || a.firstLine - b.firstLine);
  const extraOccurrences = duplicates.reduce((sum, group) => sum + group.count - 1, 0);
  const repeatedRows = duplicates.reduce((sum, group) => sum + group.count, 0);
  return {
    lines,
    keys,
    groups,
    summary: {
      totalLines: lines.length,
      distinctLines: groups.size,
      duplicateGroups: duplicates.length,
      extraOccurrences,
      repeatedRows,
      singletonRows: lines.length - repeatedRows,
      duplicates,
    },
  };
}

function analyseLines(lines, options = {}) {
  return inspectLines(lines, options).summary;
}

const analyzeLines = analyseLines;

function cleanLines(lines, options = {}) {
  const mode = options.mode ?? 'dedupe';
  if (mode !== 'dedupe' && mode !== 'unique') {
    throw new CleanaryValidationError('mode must be dedupe or unique');
  }
  const { lines: values, keys, groups } = inspectLines(lines, options);
  const seen = new Set();
  return values.filter((_, index) => {
    const key = keys[index];
    if (mode === 'unique') return groups.get(key).count === 1;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function findDuplicates(lines, options = {}) {
  return analyseLines(lines, options).duplicates;
}

function splitText(text) {
  if (typeof text !== 'string') throw new CleanaryValidationError('text must be a string');
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = bom ? text.slice(1) : text;
  const trailingNewline = /(?:\r\n|\n)$/.test(body);
  const eol = body.match(/\r\n|\n/)?.[0] ?? '\n';
  const lines = body.length ? body.split(/\r\n|\n/) : [];
  if (trailingNewline) lines.pop();
  return { lines, bom, eol, trailingNewline };
}

function analyseText(text, options = {}) {
  return analyseLines(splitText(text).lines, options);
}

const analyzeText = analyseText;

function cleanText(text, options = {}) {
  const source = splitText(text);
  const lines = cleanLines(source.lines, options);
  if (!lines.length) return '';
  return source.bom + lines.join(source.eol) + (source.trailingNewline ? source.eol : '');
}

function findDuplicateText(text, options = {}) {
  return findDuplicates(splitText(text).lines, options);
}

module.exports = {
  analyseLines,
  analyzeLines,
  cleanLines,
  findDuplicates,
  analyseText,
  analyzeText,
  cleanText,
  findDuplicateText,
  makeNormalizer,
  CleanaryValidationError,
};
