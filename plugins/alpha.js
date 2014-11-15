var rhyme = require('rhyme');
var syllabistic = require('syllablistic');
var debug = require("debug")("AlphaPlugins");


var getRandomInt = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.oppisite = function(word, cb) {

  debug("oppisite", word);

  var oppisiteWord = this.facts.query("direct_sv", word, "opposite");
  if (oppisiteWord[0]) {
    oppisiteWord = oppisiteWord[0].replace("_", " ");
    cb(null, oppisiteWord);
  } else {
    cb(null, "?!?");
  }
}

// This uses rhyme and it is painfully slow
exports.rhymes = function(word, cb) {

  debug("rhyming", word);

  rhyme(function (r) {
    var rhymedWords = r.rhyme(word);
    var i = getRandomInt(0, rhymedWords.length - 1);

    if (rhymedWords.length != 0) {
      cb(null, rhymedWords[i].toLowerCase());
    } else {
      cb(null, null);
    }
  });
}

exports.syllable = function(word, cb) {
  cb(null, syllabistic.text(word));
}

exports.letterLookup = function(cb) {
  
  var math = require("../lib/math");
  var reply = "";

  var lastWord = this.message.lemWords.slice(-1)[0];
  var alpha = "abcdefghijklmonpqrstuvwxyz".split("");
  var pos = alpha.indexOf(lastWord);

  if (this.message.lemWords.indexOf("before") != -1) {
    if (alpha[pos - 1]) {
      reply = alpha[pos - 1].toUpperCase();
    } else {  
      reply = "Don't be silly, there is nothing before A";
    }
  } else if (this.message.lemWords.indexOf("after") != -1) {
    if (alpha[pos + 1]) {
      reply = alpha[pos + 1].toUpperCase();
    } else {
      reply = "haha, funny.";
    }
  } else {
    var i = this.message.lemWords.indexOf("letter");
    var loc = this.message.lemWords[i - 1];

    if (loc == "first") {
      reply = "It is A.";
    } else if (loc == "last") {
      reply = "It is Z.";
    } else {

      // Number or word number
      // 1st, 2nd, 3rd, 4th or less then 99
      if ((loc == "st"  || loc == "nd" || loc == "rd" || loc == "th") && this.message.numbers.length != 0 ) {
        var num = parseInt(this.message.numbers[0]);
        if (num > 0 && num <= 26) {
          reply =  "It is " + alpha[num - 1].toUpperCase(); 
        } else {
          reply = "seriously...";
        }
      }
    }
  } 
  cb(null, reply);
}


exports.wordLength = function(cap, cb) {
  var reply = "";
  if (typeof cap == "string") {
    var parts = cap.split(" ");

    if (parts.length == 1) {
      reply = cap.length;
      cb(null, reply);
    } else {
      if (parts[0].toLowerCase() == "the" && parts.length == 3) {
        // name bill, word bill
        reply = parts.pop().length;
        cb(null, reply);
      } else if (parts[0] == "the" && parts[1].toLowerCase() == "alphabet") {
        reply = 26;
        cb(null, reply);
      } else if (parts[0] == "my" && parts.length == 2) {
        // Varible lookup
        var lookup = parts[1];

        

        this.user.get(lookup, function(e,v){

          if (v != -1 && v.length) {
            cb(null, "There are "+ v.length +" letters in your " + lookup + ".");
          } else {
            cb(null, "I don't know");
          }
        });
      } else if (parts[0] == "this" && parts.length == 2) {
        // this phrase, this sentence
        reply = "That phrase has " + this.message.raw.length + " characters. I think.";
        cb(null, reply);
      } else {
        reply = "I think there is about 10 characters. :)";
        cb(null, reply);
      }
    }
    
  } else {
    cap(true,"");
  }
}

exports.nextNumber = function(cb) {
  var reply = "";
  var num = this.message.numbers.slice(-1)[0];
  
  if (num) {
    if (this.message.lemWords.indexOf("before") != -1) {
      reply = parseInt(num) - 1;
    }
    if (this.message.lemWords.indexOf("after") != -1) {
      reply = parseInt(num) + 1;
    }
  }

  cb(null, reply);
};