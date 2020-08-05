const mocha = require('mocha');
const chai = require('chai');

const assert = chai.assert;

const { isSecretAddress } = require("./util");

var tests = [
    { value: function () {}, is: false},
    { value: new Function(), is: false},
    { value: 'function', is: false},
    { value: {}, is: false},
    { value: 'secret1ktfq8n50hu78uvfylwxveag3zpwtnmcs40q4p4', is: true },
    { value: 'c6d9d2cd449a754c494264e1809c50e34d64562b', is: false },
    { value: '1ktfq8n50hu78uvfylwxveag3zpwtnmcs40q4p4', is: false },
    { value: 'c6d9d2cd449a754c494264e1809c50e34d64562b', is: false },
    { value: '0xc6d9d2cd449a754c494264e1809c50e34d64562b', is: false },
    { value: '0xE247A45C287191D435A8A5D72A7C8DC030451E9F', is: false },
    { value: 'secret1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u0tvx7u', is: true },
    { value: 'secret1ktfq8n50hu78uvfylwxveag3zpwtnmcs40q4p4sd', is: false },
    { value: 'secret1ktfq8n50hu78uvfylwxveag3zpwtnmcs40q4p4', is: true },
    { value: 'SECRET1KTFQ8N50HU78UVFYLWXVEAG3ZPWTNMCS40Q4P4', is: true },
];

describe('util', function () {
    describe('isSecretAddress', function () {
        tests.forEach(function (test) {
            it('should test if value ' + test.value + ' is address: ' + test.is, function () {
                assert.equal(isSecretAddress(test.value), test.is);
            });
        });
    });
});