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

/* eslint-disable no-console */

/**
 * Converts thrift IDL files to a javascript module
 */

const path = require('path');
const fs = require('fs');

const { generateJavascriptFromThrift } = require('./lib/javascriptifier');

const rootPath = path.resolve(__dirname, '../src');
const targetDir = path.resolve(rootPath, 'generated');
const targetFile = path.resolve(targetDir, 'thrift.js');
const inputDirs = [path.resolve(rootPath, `thriftrw-idl`), path.resolve(rootPath, 'jaeger-idl/thrift')];

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

generateJavascriptFromThrift(inputDirs, targetFile, rootPath);
