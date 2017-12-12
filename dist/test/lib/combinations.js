'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = combinations;
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
function combinations(paramLists, keysParam) {
    var combination = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    var results = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

    var keys = keysParam || Object.keys(paramLists);
    if (keys.length === 0) {
        var descriptionArray = [];
        var _keys = Object.keys(paramLists);
        for (var i = 0; i < _keys.length; i++) {
            var _key = _keys[i];
            descriptionArray.push(_key + '=' + combination[_key]);
        }
        combination.description = descriptionArray.join(',');
        results.push(_shallowClone(combination));
        return results;
    }

    var key = keys[0];
    var paramList = paramLists[key];
    for (var j = 0; j < paramList.length; j++) {
        var param = paramList[j];

        combination[key] = param;
        results = combinations(paramLists, keys.slice(1), combination, results);
    }

    return results;
}

function _shallowClone(obj) {
    var newObj = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
}
//# sourceMappingURL=combinations.js.map