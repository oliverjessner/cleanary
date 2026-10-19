'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function decodeText(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    const error = new Error('input is not valid UTF-8 text');
    error.code = 'INVALID_UTF8';
    throw error;
  }
}

async function readInput(input, stdin, maxBytes) {
  if (input !== undefined && input !== '-') {
    const info = await fs.stat(input);
    if (!info.isFile()) throw new Error('input must be a regular file');
    if (info.size > maxBytes) throw new Error(`input exceeds --max-bytes limit (${maxBytes} bytes)`);
    const buffer = await fs.readFile(input);
    if (buffer.length > maxBytes) throw new Error(`input exceeds --max-bytes limit (${maxBytes} bytes)`);
    return decodeText(buffer);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) throw new Error(`stdin exceeds --max-bytes limit (${maxBytes} bytes)`);
    chunks.push(bytes);
  }
  return decodeText(Buffer.concat(chunks, size));
}

async function resolveOutput(file, command, format) {
  if (!file || typeof file !== 'string' || file.includes('\0')) throw new Error('--filepath needs a valid path');
  const resolved = path.resolve(file);
  let directory = /[\\/]$/.test(file) || !path.extname(resolved);
  try {
    const info = await fs.lstat(resolved);
    if (info.isDirectory()) directory = true;
    else throw new Error('output file already exists; choose a new --filepath');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (directory) {
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(resolved, `cleanary-${command}-${date}-${randomUUID().slice(0, 8)}.${format}`);
  }
  return resolved;
}

async function saveOutput(target, contents) {
  let handle;
  let created = false;
  try {
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    handle = await fs.open(target, 'wx', 0o600);
    created = true;
    await handle.writeFile(contents, 'utf8');
    await handle.close();
    handle = null;
    return target;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    if (created) await fs.unlink(target).catch(() => {});
    if (error.code === 'EEXIST') throw new Error('output file already exists; refusing to overwrite');
    throw error;
  }
}

module.exports = { readInput, resolveOutput, saveOutput };
