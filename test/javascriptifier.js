// Copyright (c) 2017, The Jaeger Authors
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

import {
  getFileSpecsRecursively,
  convertThriftFilesToJavascriptObject,
  writeObjectAsJavascriptModule,
  stripCommentsFromThrift,
} from '../scripts/lib/javascriptifier';
import fs from 'fs';
import mockfs from 'mock-fs';
import uuid from 'uuid/v4';
import assert from 'assert';

// guard against accidentally failing to mock filesystem
const mockRoot = `/${uuid()}`;

describe('getFileSpecsRecursively', () => {
  beforeEach(() => mockfs({ [mockRoot]: {} }));
  afterEach(() => mockfs.restore());

  it('works with no subdirectories', () => {
    const fileNames = sequence(5)
      .map(i => {
        const fileName = `test-file-${i}.tst`;
        fs.writeFileSync(`${mockRoot}/${fileName}`, `test-data-${i}`);
        return fileName;
      })
      .sort();

    const specs = getFileSpecsRecursively(mockRoot, mockRoot);
    assert.deepEqual(specs.map(e => e.relativePath).sort(), fileNames, 'file paths match');
  });

  it('works with subdirectories', () => {
    const expectedFilePaths = setUpNestedScenario(2, 5).sort();
    const specs = getFileSpecsRecursively(mockRoot, mockRoot);

    const actualFilePaths = specs.map(e => e.relativePath).sort();

    assert.deepEqual(
      expectedFilePaths,
      actualFilePaths,
      'file paths match what was returned by getFileSpecsRecursively'
    );
  });
});

describe('convertThriftFilesToJavascriptObject', () => {
  beforeEach(() => mockfs({ [mockRoot]: {} }));
  afterEach(() => mockfs.restore());

  it('creates the object as expected', () => {
    setUpNestedScenario(1, 3);
    const specs = getFileSpecsRecursively(mockRoot, mockRoot);
    const outfile = `${mockRoot}/out.js`;
    const obj = convertThriftFilesToJavascriptObject(specs);

    const allKeys = Object.keys(obj).sort();
    assert.deepEqual(
      allKeys,
      ['dir-0/file-0.tst', 'dir-0/file-1.tst', 'dir-0/file-2.tst', 'file-0.tst', 'file-1.tst', 'file-2.tst'],
      'generated module keys are as expected'
    );

    const expectedData = fs.readFileSync(`${mockRoot}/dir-0/file-1.tst`, 'ascii');
    assert.equal(obj['dir-0/file-1.tst'], expectedData, 'data matches');
  });
});

describe('writeObjectAsJavascriptModule', () => {
  beforeEach(() => mockfs({ [mockRoot]: {} }));
  afterEach(() => mockfs.restore());

  it('writes file as expected', () => {
    const obj = {
      foo: 'abc\ndef',
      'bar/baz': 'uvw\nxyz',
    };
    const targetPath = `${mockRoot}/out.js`;
    writeObjectAsJavascriptModule(obj, targetPath);

    const generatedFile = fs.readFileSync(targetPath, 'ascii');
    const generated = eval(`${generatedFile}\nmodule.exports;`);

    assert.equal(generated.foo, obj.foo, 'standard property');
    assert.equal(generated['bar/baz'], obj['bar/baz'], 'quoted property');
  });
});

describe('stripCommentsFromThrift', () => {
  it('removes various comment lines', () => {
    const data = `foo
/* a
 * b
 */
bar
baz # comment
fizz // comment
#comment
bat`;

    const expected = `foo
bar
baz
fizz
bat`;
    assert.equal(stripCommentsFromThrift(data), expected);
  });
  it("doesn't try to parse inline comments when quotes are found", () => {
    let data = 'a = "foo" # comment';
    assert.equal(stripCommentsFromThrift(data), data);

    data = "a = '2' # comment";
    assert.equal(stripCommentsFromThrift(data), data);
  });
});

// generate a hierarchy in the mock filesystem
function setUpNestedScenario(dirCount: number, filesPerDir: number): string[] {
  const dirs = sequence(dirCount).map(i => `dir-${i}`);
  dirs.forEach(dir => fs.mkdirSync(`${mockRoot}/${dir}`));
  const files = [null, ...dirs].map(dir => {
    return sequence(filesPerDir).map(i => {
      const fileName = `file-${i}.tst`;
      const filePath = dir ? `${dir}/${fileName}` : fileName;
      fs.writeFileSync(`${mockRoot}/${filePath}`, `data-${i}-line-1\ndata-${i}-line-2`);
      return filePath;
    });
  });
  return flatten(files);
}

function flatten<T>(items: Array<T | Array<T>>): T[] {
  const out: T[] = [];
  items.forEach(item => {
    if (Array.isArray(item)) {
      out.push(...flatten(item));
    } else {
      out.push(item);
    }
  });
  return out;
}

export function sequence(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(i);
  }
  return out;
}
