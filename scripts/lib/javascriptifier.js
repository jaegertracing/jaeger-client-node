// Copyright (c) 2020, The Jaeger Authors
//
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
// in compliance with the License. You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software distributed under the License
// is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
// or implied. See the License for the specific language governing permissions and limitations under
// the License.

const { lstatSync, openSync, writeSync, closeSync, readFileSync, readdirSync } = require('fs');
const path = require('path');

/**
 * Convert all files in a directory recursively to a jso of structure:
 *
 * {
 *    "filename": "file contents",
 *    "dir/filename": "file contents"
 * }
 *
 * "filename" is extensionless.
 */
function convertDirectoryToJavascriptObject(dirPath, root) {
  const fileSpecs = getFileSpecsRecursively(dirPath, root);
  return convertThriftFilesToJavascriptObject(fileSpecs);
}

/**
 * Given a set of files, generate a JavaScript module with exports named for each relative path,
 */
function generateJavascriptFromThrift(filePaths, target, rootPath) {
  const allFileSpecs = [];
  filePaths.forEach(filePath => {
    allFileSpecs.push(...getFileSpecsRecursively(filePath, rootPath));
  });

  const idls = convertThriftFilesToJavascriptObject(allFileSpecs);
  writeObjectAsJavascriptModule(idls, target);
}

/**
 * Collect specifications for each file in a hierarchy starting from dirPath,
 * relative to rootPath.
 */
function getFileSpecsRecursively(dirPath /*: string */, rootPath /*: string */) /*: FileSpec[] */ {
  const files = readdirSync(dirPath);
  const outFiles /*: string[] */ = [];
  const children /*: string[] */ = [];

  const fileData = files
    .filter(fileName => {
      const stat = lstatSync(`${dirPath}/${fileName}`);
      if (stat.isDirectory()) {
        children.push(fileName);
        return false;
      }
      outFiles.push(fileName);
      return true;
    })
    .map(fileName => {
      const filePath = `${dirPath}/${fileName}`;
      const relativePath = slash(path.relative(rootPath, filePath));
      return {
        fileName,
        filePath,
        relativePath,
      };
    });

  // recursively call for all directories we identified before and append to the output
  const childData = children.map(fileName => getFileSpecsRecursively(`${dirPath}/${fileName}`, rootPath));
  childData.forEach(data => fileData.push(...data));
  return fileData;
}

/**
 * Given a set of file specs as returned by getFileSpecsRecursively, generate a jso
 * with exports named for the relative path to each file, and returning the data
 * in each file.
 */
function convertThriftFilesToJavascriptObject(fileSpecs /*: FileSpec[] */) {
  const out = {};
  fileSpecs.forEach(spec => {
    const data = readFileSync(spec.filePath, 'utf-8');
    out[spec.relativePath] = data;
  });
  return out;
}

/**
 * Given a jso, write it as a javascript module file with exports named for each key.
 * This expects the content to be thrift IDLs and strips comments from the data.
 */
function writeObjectAsJavascriptModule(obj /*: string */, targetPath /*: string */) {
  const handle = openSync(targetPath, 'w');
  writeSync(handle, getHeader());
  Object.entries(obj).forEach(([key, value]) => {
    const js = generateJavascriptKeyValuePair(key, value);
    writeSync(handle, js);
  });
  writeSync(handle, getFooter());
  closeSync(handle);
}

/**
 * Format a key/value pair as a javascript object descriptor
 */
function generateJavascriptKeyValuePair(name /*: string*/, data /*: string*/) {
  const dataJsLiteral = '`' + escapeTemplateLiteral(stripCommentsFromThrift(data)) + '`,\n';
  return `"${name}": ${dataJsLiteral}`;
}

function getHeader() {
  return `/* eslint-disable camelcase */

// GENERATED CODE - DO NOT MODIFY!

module.exports = {
`;
}

function getFooter() {
  return '};\n';
}

// for windows
function slash(somePath) {
  return somePath.replace(/\\/g, '/');
}

const commentRegexp = /^\s*(#|\/\*|\*|\*\/|\/\/).*$/;
const inlineCommentRegexp = /^([^"']+)\s(#|\/\/).*$/;
function stripCommentsFromThrift(text) {
  return text
    .split('\n')
    .filter(line => !commentRegexp.test(line) && line.trim() !== '')
    .map(line => {
      const match = line.match(inlineCommentRegexp);
      if (match) {
        return match[1];
      }
      return line;
    })
    .join('\n');
}

function escapeTemplateLiteral(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

module.exports = {
  stripCommentsFromThrift,
  generateJavascriptFromThrift,
  convertThriftFilesToJavascriptObject,
  writeObjectAsJavascriptModule,
  getFileSpecsRecursively,
  convertDirectoryToJavascriptObject,
};
