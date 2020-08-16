var isHexadecimal = function(character) {
    var code = typeof character === 'string' ? character.charCodeAt(0) : character

    return (
      (code >= 97 /* a */ && code <= 102) /* z */ ||
      (code >= 65 /* A */ && code <= 70) /* Z */ ||
      (code >= 48 /* A */ && code <= 57) /* Z */
    )
}

function isAddress(address, prefix="secret") {
    if(address.length !== 45 || (address.toLowerCase().slice(0,6) !== prefix)) {
        return false;
    }
    if(!isHexadecimal(address.substring(6))) {
        return false;
    }
    return true;
}

module.exports = {
    isAddress,
}