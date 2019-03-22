const fs = require("fs");
const path = require("path");
const jconv = require('jconv');

let arguments = process.argv.slice(2);
if (arguments.length < 1)
    throw "Not enough arguments. Pass name of the .json file."

let fileName = arguments[0];

let jsonFileBuffer = fs.readFileSync(fileName);

let jsonFile = JSON.parse(jsonFileBuffer);

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


const entryCount = Object.keys(jsonFile).length - 1;
const parameterCount = Object.keys(jsonFile.types).length;
let binHeader = Buffer.alloc(64 * parameterCount + 16, 0x00);
let binBody = [];

binHeader.write("20070319", 0, 'hex');
binHeader.writeInt32BE(parameterCount, 4);
binHeader.writeInt32BE(entryCount, 8);

for (let currentParameter = 0; currentParameter < parameterCount; currentParameter++) {
    let parameterName = Object.keys(jsonFile.types)[currentParameter];
    let parameterType = Object.values(jsonFile.types)[currentParameter];

    let entriesWithParameter = [];
    for (let currentEntry = 0; currentEntry < entryCount; currentEntry++) {
        if (jsonFile[currentEntry].hasOwnProperty(parameterName)) entriesWithParameter.push(currentEntry);
    }

    switch (parameterType) {
        case 'string':
        case 'value':
        case 'stageid':
            {
                let entriesString = '';
                for (let i = 0; i < entriesWithParameter.length; i++) {
                    entriesString += jsonFile[entriesWithParameter[i]][parameterName];
                    entriesString += '\0';
                }
                entriesString += '\0\0';
                binBody[currentParameter] = Buffer.from(jconv.convert(entriesString, 'utf-8', 'SJIS'));

                binHeader.writeInt32BE(entriesWithParameter.length, 16 + currentParameter * 64 + 52);
                binHeader.writeInt32BE(binBody[currentParameter].length, 16 + currentParameter * 64 + 56);
                break;
            }

        case 'string_tbl':
        case 'value_tbl':
            {
                let entriesString = '';
                let uniqueEntries = []

                for (let i = 0; i < entriesWithParameter.length; i++) {
                    uniqueEntries.push(jsonFile[entriesWithParameter[i]][parameterName]);
                }

                uniqueEntries = uniqueEntries.filter((v, i, a) => a.indexOf(v) === i);

                for (let i = 0; i < uniqueEntries.length; i++) {
                    entriesString += new Buffer.from(uniqueEntries[i]).toString('hex');
                    entriesString += '00';
                }
                for (let i = 0; i < entryCount; i++) {
                    entriesString += ('00' + (uniqueEntries.indexOf(jsonFile[i][parameterName])).toString(16)).slice(-2);
                }

                entriesString += '0000';
                binBody[currentParameter] = Buffer.from(entriesString, 'hex');

                binHeader.writeInt32BE(uniqueEntries.length, 16 + currentParameter * 64 + 52);
                binHeader.writeInt32BE(binBody[currentParameter].length, 16 + currentParameter * 64 + 56);
                break;
            }

        case 'string_idx':
        case 'value_idx':
            {
                let entriesString = '';
                let entryCount = 0;

                for (let i = 0; i < entriesWithParameter.length; i++) {
                    if (jsonFile[entriesWithParameter[i]][parameterName] !== '') {
                        entriesString += ('0000' + entriesWithParameter[i].toString(16).toUpperCase()).slice(-4);
                        entriesString += new Buffer.from(jsonFile[entriesWithParameter[i]][parameterName]).toString('hex');
                        entriesString += '00';
                        entryCount++;
                    }
                }
                entriesString += '0000';
                binBody[currentParameter] = Buffer.from(entriesString, 'hex');

                binHeader.writeInt32BE(entryCount, 16 + currentParameter * 64 + 52);
                binHeader.writeInt32BE(binBody[currentParameter].length, 16 + currentParameter * 64 + 56);

                break;
            }

        case 'special_scenariostatus':
            {
                let entriesString = '';
                for (let i = 0; i < entriesWithParameter.length; i++) {
                    entriesString += jsonFile[entriesWithParameter[i]][parameterName];
                    entriesString += 'FFFFFFFF'
                }
                binBody[currentParameter] = Buffer.from(entriesString, 'hex');

                binHeader.writeInt32BE(entriesWithParameter.length, 16 + currentParameter * 64 + 52);
                binHeader.writeInt32BE(binBody[currentParameter].length, 16 + currentParameter * 64 + 56);
                break;
            }

        case 'special_scenariocategory':
        case 'special_scenariocompare':
        case 'BGM_ID':
        case 'special_value':
        case 'itemid':
        case 'USE_COUNTER':
        case 'ENTITY_UID':
            {
                let entriesString = '';
                for (let i = 0; i < entriesWithParameter.length; i++) {
                    entriesString += ('00000000' + jsonFile[entriesWithParameter[i]][parameterName].toString(16).toUpperCase()).slice(-8);;
                }
                binBody[currentParameter] = Buffer.from(entriesString, 'hex');

                binHeader.writeInt32BE(entriesWithParameter.length, 16 + currentParameter * 64 + 52);
                binHeader.writeInt32BE(binBody[currentParameter].length, 16 + currentParameter * 64 + 56);
                break;
            }


        case 'comment':
            console.log("Comments won't be imported, since it is unknown how to store them.");
            binBody[currentParameter] = Buffer.from('');
            break;

        default:
            throw "Unknown parameter type.";
            break;
    }

    jconv.encode(parameterName, 'SJIS').copy(binHeader, 16 + currentParameter * 64);
    binHeader.writeInt32BE(parameterTypes.indexOf(parameterType), 16 + currentParameter * 64 + 48);

}

fs.writeFileSync(fileName + ".bin", binHeader);
for (let i = 0; i < binBody.length; i++)
    fs.writeFileSync(fileName + ".bin", binBody[i], { flag: "a" });