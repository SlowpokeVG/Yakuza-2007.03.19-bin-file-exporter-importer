const fs = require("fs");
const path = require("path");

let arguments = process.argv.slice(2);
if (arguments.length < 1)
    throw "Not enough arguments. Pass name of the .bin file."

let fileName = arguments[0];

let codePage = 'utf-8';

//if (arguments[1] == 'jp') codePage = arguments[1];
//!implement CP932 support

let binFile = fs.readFileSync(fileName);

if (binFile.toString('hex', 0, 4) !== '20070319') {
    console.log("Not 20070319 .bin file");
    return;
}

const parameterAmount = binFile.readInt32BE(4);
const entryAmount = binFile.readInt32BE(8);

let jsonObject = {};
jsonObject.types = {};
const parameterTypes = [
    'string',                       // 00: Strings, separated with 0x00;
    'string_tbl',                   // 01: Strings, separated with 0x00 with table after last 0x00;
    'string_idx',                   // 02: Strings, 2 bytes for ID it's used from, then the value and 0x00;

    'value',                        // 03: Integers as text like 00;
    'value_tbl',                    // 04:  Integers as text. Same as 01 - table after 0x00;
    'value_idx',                    // 05:  Integers as text. Same as 02;

    'special_scenariocategory',     // 06:  4 byte hex values, not separated, 0xFFFFFFFF is "empty";
    'special_scenariostatus',       // 07: or sometimes special_scenariocompare; 4 Byte hex values, separated by 0xFFFFFFFF;

    'stageid',                      // 08: Strings, separated with 0x00;

    'special_scenariocompare',      // 09: 4 byte hex values, not separated, 0xFFFFFFFF is "empty";

    'special_value',                // 0A: 4 byte int values, go one after another;
    'itemid',                       // 0B: 4 byte int values, go one after another;

    'comment',                      // 0C: Never encountered in game files, so not implemented;
    'BGM_ID',                        // 0D: 4 byte values, not separated, 0xFFFFFFFF is "empty";
    'unknown',                      // 0E: Never encountered in game files, so not implemented;
    'USE_COUNTER',                  // 0F: 4 byte int values, go one after another;
    'ENTITY_UID'                    // 10: 4 byte values, not separated, 0xFFFFFFFF is "empty";

]

console.log(parameterAmount + " parameters");
console.log(entryAmount + " entries");

const headerEnd = 64 * parameterAmount + 16;
let currentPosition = 0;

for (let currentEntry = 0; currentEntry < entryAmount; currentEntry++) {
    jsonObject[currentEntry] = {};
}

for (let currentParam = 0; currentParam < parameterAmount; currentParam++) {
    let parameterName = binFile.toString(codePage, 16 + 64 * currentParam, 16 + 64 * currentParam + 48).replace(/\0/g, '');
    let parameterType = binFile.readInt32BE(16 + 64 * currentParam + 48);
    let parameterCount = binFile.readInt32BE(16 + 64 * currentParam + 52);
    let parameterSize = binFile.readInt32BE(16 + 64 * currentParam + 56);

    jsonObject.types[parameterName] = parameterTypes[parameterType];

    if (parameterSize == 0) continue;

    let parameterBuffer = new Buffer.alloc(parameterSize);
    binFile.copy(parameterBuffer, 0, headerEnd + currentPosition, headerEnd + currentPosition + parameterSize);

    switch (parameterType) {

        case 0: case 3: case 8:
            let strings = parameterBuffer.toString(codePage).split('\0');
            for (let currentEntry = 0; currentEntry < entryAmount; currentEntry++) {
                jsonObject[currentEntry][parameterName] = strings[currentEntry];
            }
            break;

        case 1: case 4:
            let stringsForTable = parameterBuffer.toString(codePage).split('\0', parameterCount);
            let tableStart = 0;
            let wordCount = 0;

            for (let currentByte = 0; currentByte < parameterBuffer.length; currentByte++) {
                if (parameterBuffer[currentByte] === 0x00) wordCount++;
                if (wordCount >= parameterCount + 1) {
                    tableStart = currentByte;
                    break;
                }
            }

            for (let currentEntry = 0; currentEntry < entryAmount; currentEntry++) {
                jsonObject[currentEntry][parameterName] = stringsForTable[parameterBuffer[tableStart + currentEntry]];

            }
            break;

        case 2: case 5:

            let currentByte = 0;
            let currentWord = 0;
            while ((currentWord < parameterCount) && (currentByte < parameterBuffer.length)) {
                const entryID = parameterBuffer.readInt16BE(currentByte);
                currentByte += 2;
                let wordEndByte = currentByte;
                while ((parameterBuffer[wordEndByte] != 0x00) && (wordEndByte < parameterBuffer.length)) wordEndByte++;
                for (let i = entryID; i < Object.keys(jsonObject).length - 1; i++)
                    jsonObject[i][parameterName] = parameterBuffer.toString(codePage, currentByte, wordEndByte);
                currentByte = wordEndByte + 1;
                currentWord++;
            }

            break;

        case 6: case 9: case 13: case 16:
            let hexValues = parameterBuffer.toString('hex').match(/.{1,8}/g);
            for (let currentEntry = 0; currentEntry < entryAmount; currentEntry++) {
                jsonObject[currentEntry][parameterName] = hexValues[currentEntry];
            }
            break;

        case 7:
            let scenariostatus = parameterBuffer.toString('hex').replace(/.{8}/g, '$& ').split(/f{8}/ig);
            for (let currentEntry = 0; currentEntry < entryAmount; currentEntry++) {
                jsonObject[currentEntry][parameterName] = scenariostatus[currentEntry].replace(/\s/g, '');
            }
            break;

        case 10: case 11: case 15:
            let specialvalues = parameterBuffer.toString('hex').match(/.{1,8}/g);
            for (let currentEntry = 0; currentEntry < entryAmount; currentEntry++) {
                jsonObject[currentEntry][parameterName] = parseInt(specialvalues[currentEntry], 16);
            }
            break;

        case 12:
            console.log('Comments are available. Please send file to script developer for analysis.')
            break;

        case 14: default:
            throw 'Unknown parameter type ' + parameterType;
    }

    currentPosition += parameterSize;
}

fs.writeFileSync(fileName + ".json", JSON.stringify(jsonObject, null, 2));
