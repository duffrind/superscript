var pos     = require("pos");
var _       = require("underscore");
var natural = require("natural");
var math    = require("./math");
var ngrams  = natural.NGrams;
var tense   = require("node-tense");
var moment  = require("moment");
var Lemmer  = require('node-lemmer').Lemmer;
var Dict    = require("./dict");
var Utils   = require("./utils");
var crc     = require("crc");
var async   = require("async");
var debug   = require("debug")("Message");

function Message(msg, qtypes, norm, cnet, facts, cb) {
  debug("Creating message from:", msg);

  if (!msg) {
    debug("Callback Early, empty msg")
    return cb({});
  }

  var that = this;
  that.facts = facts;
  that.createdAt = new Date();
  that.raw = msg;
  
  // TODO Move this to NORM and make Greedy
  msg = msg.replace(" , ", " ");

  that.clean = norm.clean(msg).trim();

  that.crc = crc.crc32(msg).toString(16);

  var wordArray = new pos.Lexer().lex(that.clean);
  // This is where we keep the words
  that.dict = new Dict(wordArray);

  // TODO Phase out words, cwords
  that.words = wordArray;
  that.cwords = math.convertWordsToNumbers(wordArray);
  that.taggedWords = new pos.Tagger().tag(that.cwords);
  
  that.lemWords = that.lemma();

  var posArray = that.taggedWords.map(function(hash){ return hash[1]});
  var lemString = that.lemWords.join(" ");
  that.lemString = lemString;
  that.posString = posArray.join(" ");
  
  that.dict.add("num", that.cwords);
  that.dict.add("lemma", that.lemWords);
  that.dict.add("pos", posArray);

  // Classify Question
  that.qtype = qtypes.classify(lemString);
  that.qSubType = qtypes.questionType(lemString);
  that.isQuestion = qtypes.isQuestion(that.clean);

  // Sentence Sentiment
  that.sentiment = 0;

  // Get Nouns and Noun Phrases.
  that.nouns = this.fetchNouns();
  that.names = this.fetchComplexNouns("names");

  // A list of terms
  // This would return an array of thems that are a, b and c;
  // Helpful for choosing something when the qSubType is CH
  that.list = this.fetchList();

  that.adjectives = this.fetchAdjectives();
  that.adverbs = this.fetchAdverbs();
  that.verbs = this.fetchVerbs();
  that.pronouns = that.pnouns = this.fetchProNouns();
  that.compareWords = this.fetchCompareWords();
  that.numbers = this.fetchNumbers();
  that.compare = (that.compareWords.length != 0);
  that.date = this.fetchDate();

  // Second pass on names, using local concepts, just in case we missed anything
  // Commented out until we re-add the fact system
  // for (var i = 0; i < that.nouns.length; i++) {
  //   if (_.contains(facts.query("direct_sv", that.nouns[i], "isa"), "names")) {
  //     var add = true;
  //     _.each(that.names, function(item){
  //       var it = item.toLowerCase();
  //       if (it.indexOf(that.nouns[i].toLowerCase()) != -1) {
  //         add = false;
  //       } 
  //     })
  //     if (add === true) {
  //       that.names.push(that.nouns[i]); 
  //     }
  //   }
  // }

  that.names = _.uniq(that.names, function(name) {return name.toLowerCase()});

  // Nouns with Names removed.
  var t = that.names.map(function(i) { return i.toLowerCase() });
  that.cNouns = _.filter(that.nouns, function(item){
    return (!_.contains(t, item.toLowerCase()));
  });

  var _tense = [];
  var numCount = 0;
  var oppCount = 0;
  
  for (var i = 0; i < that.taggedWords.length; i++) {
    if (that.taggedWords[i][1] == 'CD') { 
      numCount++;
    }
    
    if (that.taggedWords[i][1] == 'SYM' || math.mathTerms.indexOf(that.lemWords[i]) !== -1) {
      // Half is a number and not an opp
      if (that.taggedWords[i][0] == "half") {
        numCount++;
      } else {
        oppCount++;
      }
    }
  }

  // Augment the Qtype for Math Expressions
  that.numericExp = (numCount >= 2 && oppCount >= 1) ? true : false;
  that.halfNumericExp = (numCount == 1 && oppCount == 1) ? true : false;

  if (that.numericExp || that.halfNumericExp) {
      that.qtype = "NUM:expression";
      that.isQuestion = true;
  }


  // Things are nouns + complex nouns so 
  // turkey and french fries would return ['turkey','french fries']
  // This should probably run the list though concepts or something else to validate them more
  // than NN NN etc.
  that.fetchNE(function(entities){

    var things = that.fetchComplexNouns("nouns");
    var fullEntities = entities.map(function(ar){ return ar.join(" ");});
    
    that.entities = patchList(fullEntities, things);
    that.list = patchList(fullEntities, that.list);

    debug("Message", that);
    cb(that);
  });
}

Message.prototype.toLog = function(prefix) {
  return this.createdAt + " (" + prefix + ") " + this.raw + " \r\n";
}

Message.prototype.findSentiment = function(hlc) {
  for (var i = 0; i < hlc.length; i++) {
    if (_.contains(hlc[i].hlc, "weakbadness")) {
      that.sentiment += -1;
    }
    if (_.contains(hlc[i].hlc, "badness")) {
      that.sentiment += -2;
    }
    if (_.contains(hlc[i].hlc, "strongbadness")) {
      that.sentiment += -3;
    }
    if (_.contains(hlc[i].hlc, "weakgoodness")) {
      that.sentiment += 1;
    }
    if (_.contains(hlc[i].hlc, "goodness")) {
      that.sentiment += 2;
    }
    if (_.contains(hlc[i].hlc, "stronggoodness")) {
      that.sentiment += 3;
    }
  }
}
Message.prototype.fetchCompareWords = function() {
  return this.dict.fetch("pos", ["JJR", "RBR"]);
}

Message.prototype.fetchAdjectives = function() {
  return this.dict.fetch("pos", ["JJ", "JJR", "JJS"]);
}

Message.prototype.fetchAdverbs = function() {
  return this.dict.fetch("pos", ["RB", "RBR", "RBS"]);
}

Message.prototype.fetchNumbers = function() {
  return this.dict.fetch("pos", ["CD"]);
}

Message.prototype.fetchVerbs = function() {
  return this.dict.fetch("pos", ["VB", "VBN", "VBD", "VBZ", "VBP", "VBG"]);
}

Message.prototype.fetchProNouns = function() {
  return this.dict.fetch("pos", ["PRP", "PRP$"]);
}

Message.prototype.lemma = function() {
  var that = this;
  var lemmerEng = new Lemmer('english');

  return _.map(that.taggedWords, function(item, key){ 
    var w = item[0].toLowerCase();
    var lw = lemmerEng.lemmatize(w);
    return (lw.length != 0) ? lw[0].text.toLowerCase() : w;
  });
}

Message.prototype.fetchNouns = function() {
  return this.dict.fetch("pos", ["NN", "NNS", "NNP", "NNPS"]);
}

// Fetch list looks for a list of items
// a or b
// a, b or c
Message.prototype.fetchList = function() {
  debug("Fetch List");
  var that = this;
  var l = [];
  if (/NNP? CC(?:\s*DT\s|\s)NNP?/.test(that.posString) || /NNP? , NNP?/.test(that.posString) || /NNP? CC(?:\s*DT\s|\s)JJ NNP?/.test(that.posString)) {
    var sn = false;
    for (var i = 0; i < that.taggedWords.length; i++) {
      if (that.taggedWords[i+1] && (that.taggedWords[i+1][1] == "," || that.taggedWords[i+1][1] == "CC" || that.taggedWords[i+1][1] == "JJ")) {
        sn = true;
      }
      if (that.taggedWords[i+1] === undefined) {
       sn = true; 
      }
      if (sn === true && Utils._isTag(that.taggedWords[i][1], 'nouns')) {
        l.push(that.taggedWords[i][0]);
        sn = false;
      }
    }
  }
  debug("Return with ", l)
  return l;
}

Message.prototype.fetchDate = function() {
  var that = this;
  var date = null;
  var months = ['january','february','march','april','may','june','july','august','september','october','november','december'];

  // http://rubular.com/r/SAw0nUqHJh
  var re = /([a-z]{3,10}\s+[\d]{1,2}\s?,?\s+[\d]{2,4}|[\d]{2}\/[\d]{2}\/[\d]{2,4})/i;

  if (m = that.clean.match(re)) {
    debug("Date", m);
    date = moment(Date.parse(m[0]));
  }

  if (that.qtype === "NUM:date" && date == null) {
    debug("Try to resolve Date");
    // TODO, in x months, x months ago, x months from now
    if (_.contains(that.nouns, "month")) {
      if (that.dict.contains("next")) {
        date = moment().add('M', 1);
      }
      if (that.dict.contains("last")) {
        date = moment().subtract('M', 1);
      }
    } else {
      // IN month vs ON month
      if (Utils.inArray(that.nouns, months)) {
        var p = Utils.inArray(that.nouns, months);
        date = moment(that.nouns[p] + " 1", "MMM D")
      }
    }
  }

  return date;
}

// Fetch Named Entities.
// Pulls concepts from the bigram DB. 
Message.prototype.fetchNE = function(callback) {
  
  var bigrams = ngrams.bigrams(this.taggedWords);
  var that = this;

  var sentencebigrams = _.map(bigrams, function(bigram, key) {
    return _.map(bigram, function(item, key2) { return item[0]; });
  });

  var itor = function(item, cb) {
    that.facts.db.get({subject:item.join(" "),  predicate: 'isa', object: 'bigram' }, function(err, res){
      if (!_.isEmpty(res)) {
        cb(true);
      } else {
        cb();
      }
    });
  }

  async.filter(sentencebigrams, itor, function(res){
    callback(res);
  });
}

// This function will return proper nouns and group them together if they need be.
// This function will also return regular nonus or common nouns grouped as well.
// Rob Ellis and Brock returns ['Rob Ellis', 'Brock']
// @tags - Array, Words with POS [[word, pos], [word, pos]]
// @lookupType String, "nouns" or "names"
Message.prototype.fetchComplexNouns = function(lookupType) {
  var tags = this.taggedWords;
  var bigrams = ngrams.bigrams(tags); 
  var nouns, tester;
  var that = this;

  if (lookupType == "names") {
    tester = function(item) { return (item[1] == "NNP" || item[1] == "NNPS") }  
  } else {
    tester = function(item) { return (item[1] == "NN" || item[1] == "NNS" || item[1] == "NNP" ||  item[1] == "NNPS") }  
  }
  nouns = _.filter(_.map(tags, function(item, key){ return (tester(item)) ? item[0] : null }),Boolean);
  var nounBigrams = ngrams.bigrams(nouns);

  // Get a list of term
  var neTest = _.map(bigrams, function(bigram, key) {
    return _.map(bigram, function(item, key2) { return tester(item); });
  });

  // Return full names from the list
  var fullnames  = _.map(_.filter(_.map(neTest, function(item, key){
    return (_.every(item, _.identity)) ? bigrams[key] : null}), Boolean),
    function(item, key) {
      return (_.map(item, function(item2,key3){return item2[0]  })).join(" ");
    }
  );

  debug("fullnames", lookupType, fullnames)

  var x = _.map(nounBigrams, function(item, key) {
    return _.contains(fullnames, item.join(" "));
   })

  // Filter X out of the bigrams or names?
  _.filter(nounBigrams, function(item, key){
    if (x[key]) {
      // Remove these from the names
      nouns.splice(nouns.indexOf(item[0]), 1);
      nouns.splice(nouns.indexOf(item[1]), 1);
      return nouns;
    }
  });

  return nouns.concat(fullnames);
}

var patchList = function(fullEntities, things) {
  for (var i = 0; i < fullEntities.length; i++) {
    for (var j = 0; j < things.length; j++) {
      var thing = things[j];
      if (fullEntities[i].indexOf(thing) > 0) {
        things[j] = fullEntities[i];
      }
    }
  }
  return things;
}


module.exports = Message;
