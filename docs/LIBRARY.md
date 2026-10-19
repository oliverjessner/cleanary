# Cleanary library

Node.js 26+, no runtime dependencies. CommonJS, ESM and TypeScript declaration support.

```js
import { analyseLines, cleanLines, cleanText, findDuplicates } from 'cleanary';

const rows = [' Home ', 'home', 'Other'];
const options = { trim: true, caseSensitive: false };
console.log(analyseLines(rows, options));
console.log(cleanLines(rows, { ...options, mode: 'dedupe' })); // [' Home ', 'Other']
console.log(cleanLines(rows, { ...options, mode: 'unique' })); // ['Other']
console.log(findDuplicates(rows, options));
console.log(cleanText('a\na\nb\n', { mode: 'dedupe' })); // 'a\nb\n'
```

Public methods:

| Export | Input | Result |
| --- | --- | --- |
| `analyseLines` / `analyzeLines` | iterable of string rows, options | analysis object |
| `cleanLines` | iterable of string rows, options with `mode` | retained string rows |
| `findDuplicates` | iterable of rows, options | duplicate group objects |
| `analyseText` / `analyzeText` | UTF-16 JavaScript string, options | analysis object |
| `cleanText` | text string, options with `mode` | text string |
| `findDuplicateText` | text string, options | duplicate groups |
| `makeNormalizer` | options | row => matching key |
| `CleanaryValidationError` | error class | thrown for invalid API input |

Default `{ caseSensitive: true, trim: false }`. The optional `normalize(value)` callback receives a key **after** the built-in trim and/or lowercasing operation, and must return a string. Keys, not emitted text, are transformed.

Example extension: ignore URL tracking query strings (intentionally naive example for your own trusted URL list):

```js
const { cleanLines } = require('cleanary');
const clean = cleanLines([
  'https://example.test/?utm_source=a',
  'https://example.test/?utm_source=b',
], {
  normalize(value) {
    const url = new URL(value);
    url.searchParams.delete('utm_source');
    return url.href;
  },
});
```

The core never accesses the network or the filesystem; CLI I/O belongs in `cli/io.js`. Extend the tool by adding normalizers or new CLI commands rather than duplicating its matching algorithm. Analysis is O(n) on average in expected map operations, with O(g log g) sorting for g duplicate groups; memory usage is proportional to input rows and distinct keys. The `cleanLines` implementation materializes iterables, so it is not a streaming transform.
