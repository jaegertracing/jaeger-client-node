

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
