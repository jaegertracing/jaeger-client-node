'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.parseCommaSeparatedBaggage = parseCommaSeparatedBaggage;

// Copyright (c) 2017 The Jaeger Authors
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
* Parses a comma separated key=value pair list and add the reuslts to `baggage`.
* E.g. "key1=value1, key2=value2, key3 = value3"
* is converted to map[string]string { "key1" : "value1",
*                                     "key2" : "value2",
*                                     "key3" : "value3" }
*
* @param {any} baggage- the object container to accept the parsed key=value pairs
* @param {string} values - the string value containing any key=value pairs
* to parse
*/
function parseCommaSeparatedBaggage(baggage, values) {
    values.split(',').forEach(function (keyVal) {
        var splitKeyVal = keyVal.trim().split('=');
        if (splitKeyVal.length == 2) {
            baggage[splitKeyVal[0]] = splitKeyVal[1];
        }
    });
}
//# sourceMappingURL=baggage.js.map