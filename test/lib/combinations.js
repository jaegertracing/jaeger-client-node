// Copyright (c) 2016 Uber Technologies, Inc.
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

/**
 * Example:
 * combinations(['encoding', 'mode'], {encoding: ['json', 'thrift'], mode: ['channel', 'request']})
 * Produced combinations:
 *
 * [{ encoding: 'json', mode: 'channel' },
 *  { encoding: 'json', mode: 'request' },
 *  { encoding: 'thrift', mode: 'channel' },
 *  { encoding: 'thrift', mode: 'request' }]
 * */
export default function combinations(paramLists, keysParam, combination = {}, results = []) {
    let keys = keysParam || Object.keys(paramLists);
    if (keys.length === 0) {
        let descriptionArray = [];
        let keys = Object.keys(paramLists);
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            descriptionArray.push(`${key}=${combination[key]}`);
        }
        combination.description = descriptionArray.join(',');
        results.push(_shallowClone(combination));
        return results;
    }

    let key = keys[0];
    let paramList = paramLists[key];
    for (let j = 0; j < paramList.length; j++) {
        let param = paramList[j];

        combination[key] = param;
        results = combinations(paramLists, keys.slice(1),  combination, results);
    }

    return results;
}

function _shallowClone(obj) {
    let newObj = {};
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}
