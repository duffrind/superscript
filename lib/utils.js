var debug = require("debug")("Utils");
var _ = require("underscore");
var lex = require("pos").Lexer;

// Strip whitespace from a string.
// We preserve new lines
exports.trim = function (text) {
  var before = text;
  text = text || "";
  text = text.replace(/^[\s\t]+/i, "");
  text = text.replace(/[\s\t]+$/i, "");
  
  // text = text.replace(/[\x0D\x0A]+/, "");
  text = text.replace(/\s{2,}/g, ' ');

  if (before != text) debug("Trim", text);
  return text;
};

// Count real words in a string.
exports.wordCount = function (trigger) {
  var words = [];
  words = trigger.split(/[\s\*\#\_\|]+/);

  var wc = 0;
  for (var i = 0, end = words.length; i < end; i++) {
    if (words[i].length > 0) {
      wc++;
    }
  }

  return wc;
};

Array.prototype.chunk = function(chunkSize) {
  var R = [];
  for (var i=0; i<this.length; i+=chunkSize)
      R.push(this.slice(i,i+chunkSize));
  return R;
}

exports.sentenceSplit = function(message) {
  var lexer = new lex();
  var bits = lexer.lex(message);
  var R = [], L = [];
  for (var i=0; i<bits.length; i++) { 
    if (bits[i] == ".") {
      // Push the punct
      R.push(bits[i]);
      L.push(R.join(" "));
      R = [];
    } else {

      if (bits[i] == "," && R.length >= 3 && _.contains(["who","what","where","when","why"], bits[i+1])) {
        R.push(bits[i]);
        L.push(R.join(" "));
        R = [];
      } else {
        R.push(bits[i]);
      }
    }
  }

  // if we havd left over R, push it into L (no punct was found)
  if (R.length != 0) {
    L.push(R.join(" "));
  }

  return L;
}

// Escape a string for a regexp.
exports.quotemeta = function (string) {
  var unsafe = "\\.+*?[^]$(){}=!<>|:";
  for (var i = 0; i < unsafe.length; i++) {
    string = string.replace(new RegExp("\\" + unsafe.charAt(i), "g"), "\\" + unsafe.charAt(i));
  }
  return string;
};

exports.cleanArray = function(actual){
  var newArray = new Array();
  for(var i = 0; i < actual.length; i++){
    if (actual[i]) {
      newArray.push(actual[i]);
    }
  }
  return newArray;
}


var indefiniteArticlerize = exports.indefiniteArticlerize = function(word) {
  var A_REQUIRING_PATTERNS = /^(([bcdgjkpqtuvwyz]|onc?e|onetime)$|e[uw]|uk|ur[aeiou]|use|ut([^t])|uni(l[^l]|[a-ko-z]))/i;
  var AN_REQUIRING_PATTERNS = /^([aefhilmnorsx]$|hono|honest|hour|heir|[aeiou])/i;
  var UPCASE_A_REQUIRING_PATTERNS = /^(UN$)/;
  var UPCASE_AN_REQUIRING_PATTERNS = /^$/ 

  var firstWord = String(word).split(/[- ]/)[0];
  if ((AN_REQUIRING_PATTERNS.test(firstWord) || UPCASE_AN_REQUIRING_PATTERNS.test(firstWord)) &&
     !(A_REQUIRING_PATTERNS.test(firstWord) || UPCASE_A_REQUIRING_PATTERNS.test(firstWord))) {
    return 'an ' + word;
  } else {
    return 'a ' + word;
  }
}

exports.indefiniteList = function(list) {
  var n = [];
  for (var i = 0; i < list.length; i++) {
    n.push(indefiniteArticlerize(list[i]));
  }
  if (n.length > 1) {
    var last = n.pop();
    return n.join(", ") + " and " + last;   
  } else {
    return n.join(", ");
  }
}

exports.getRandomInt = getRandomInt = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.pickItem = function(arr) {
  var ind = getRandomInt(0, arr.length - 1);
  return arr[ind];
}

exports.ucwords = function(str) {
  return str.toLowerCase().replace(/\b[a-z]/g, function(letter) {
    return letter.toUpperCase();
  });
}

// Capital first letter, and add period.
exports.makeSentense = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1) + ".";
}


