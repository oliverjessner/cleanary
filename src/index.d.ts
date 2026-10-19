export interface NormalizationOptions {
  /** Exact matching is the default. Set false to use Unicode lowercasing. */
  caseSensitive?: boolean;
  /** Compare trimmed values without changing emitted rows. Default: false. */
  trim?: boolean;
  /** Optional additional custom matching key transformation. */
  normalize?: (value: string) => string;
}

export interface CleanOptions extends NormalizationOptions {
  /** dedupe: keep first occurrence; unique: keep only rows that occur once. */
  mode?: 'dedupe' | 'unique';
}

export interface DuplicateGroup {
  /** Original value from the earliest occurrence, unmodified. */
  value: string;
  count: number;
  /** 1-based line number of the first occurrence. */
  firstLine: number;
}

export interface Analysis {
  totalLines: number;
  distinctLines: number;
  duplicateGroups: number;
  /** Number of copies beyond the first in each duplicate group. */
  extraOccurrences: number;
  /** Number of rows belonging to groups that appear more than once. */
  repeatedRows: number;
  singletonRows: number;
  /** Descending count, then ascending firstLine. */
  duplicates: DuplicateGroup[];
}

export class CleanaryValidationError extends TypeError {}
export function makeNormalizer(options?: NormalizationOptions): (value: string) => string;
export function analyseLines(lines: Iterable<string>, options?: NormalizationOptions): Analysis;
export const analyzeLines: typeof analyseLines;
export function findDuplicates(lines: Iterable<string>, options?: NormalizationOptions): DuplicateGroup[];
export function cleanLines(lines: Iterable<string>, options?: CleanOptions): string[];
export function analyseText(text: string, options?: NormalizationOptions): Analysis;
export const analyzeText: typeof analyseText;
export function findDuplicateText(text: string, options?: NormalizationOptions): DuplicateGroup[];
export function cleanText(text: string, options?: CleanOptions): string;

declare const cleanary: {
  makeNormalizer: typeof makeNormalizer;
  analyseLines: typeof analyseLines;
  analyzeLines: typeof analyzeLines;
  cleanLines: typeof cleanLines;
  findDuplicates: typeof findDuplicates;
  analyseText: typeof analyseText;
  analyzeText: typeof analyzeText;
  cleanText: typeof cleanText;
  findDuplicateText: typeof findDuplicateText;
  CleanaryValidationError: typeof CleanaryValidationError;
};
export default cleanary;
