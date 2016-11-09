import _ from 'lodash';
import qtypes from 'qtypes';
import pos from 'parts-of-speech';
import natural from 'natural';
import moment from 'moment';
import Lemmer from 'lemmer';
import async from 'async';
import debuglog from 'debug-levels';
import normalize from 'node-normalizer';

import math from './math';
import Dict from './dict';
import Utils from './utils';

const debug = debuglog('SS:Message');
const ngrams = natural.NGrams;

const patchList = function (fullEntities, things) {
  const stopList = ['I'];

  things = things.filter(item =>
     !(stopList.indexOf(item) !== -1)
  );

  for (let i = 0; i < fullEntities.length; i++) {
    for (let j = 0; j < things.length; j++) {
      const thing = things[j];
      if (fullEntities[i].indexOf(thing) > 0) {
        things[j] = fullEntities[i];
      }
    }
  }
  return things;
};

const cleanMessage = function cleanMessage(message) {
  message = message.replace(/\./g, ' ');
  message = message.replace(/\s,\s/g, ' ');
  // these used to be bursted but are not anymore.
  message = message.replace(/([a-zA-Z]),\s/g, '$1 ');
  message = message.replace(/"(.*)"/g, '$1');
  message = message.replace(/\s"\s?/g, ' ');
  message = message.replace(/\s'\s?/g, ' ');
  message = message.replace(/\s?!\s?/g, ' ');
  message = message.replace(/\s?!\s?/g, ' ');
  return message;
};

// The message could be generated by a reply or raw input
// If it is a reply, we want to save the ID so we can filter them out if said again
class Message {
  /**
   * Creates a new Message object.
   * @param {String} message - The cleaned message.
   * @param {Object} options - The parameters.
   * @param {String} options.original - The original message text.
   * @param {Object} options.factSystem - The fact system to use.
   * @param {String} [options.replyId] - If the message is based on a reply.
   * @param {String} [options.clearConvo] - If you want to clear the conversation.
   */
  constructor(message, options) {
    debug.verbose(`Creating message from string: ${message}`);

    this.id = Utils.genId();

    // If this message is based on a Reply.
    if (options.replyId) {
      this.replyId = options.replyId;
    }

    if (options.clearConvo) {
      this.clearConvo = options.clearConvo;
    }

    this.factSystem = options.factSystem;
    this.createdAt = new Date();

    // This version of the message is `EXACTLY AS WRITTEN` by the user
    this.original = message;
    this.raw = normalize.clean(message).trim();
    this.clean = cleanMessage(this.raw).trim();
    debug.verbose('Message before cleaning: ', message);
    debug.verbose('Message after cleaning: ', this.clean);

    this.props = {};

    let words = new pos.Lexer().lex(this.clean);
    // This is used in the wordnet plugin (removing it will break it!)
    this.words = words;

    // This is where we keep the words
    this.dict = new Dict(words);

    words = math.convertWordsToNumbers(words);
    this.taggedWords = new pos.Tagger().tag(words);
  }

  static createMessage(message, options, callback) {
    if (!message) {
      debug.verbose('Message received was empty, callback immediately');
      return callback({});
    }

    const messageObj = new Message(message, options);
    messageObj.finishCreating(callback);
  }

  finishCreating(callback) {
    this.lemma((err, lemWords) => {
      if (err) {
        console.log(err);
      }

      this.lemWords = lemWords;
      this.lemString = this.lemWords.join(' ');

      this.posWords = this.taggedWords.map(hash =>
         hash[1]
      );
      this.posString = this.posWords.join(' ');

      this.dict.add('lemma', this.lemWords);
      this.dict.add('pos', this.posWords);

      // Classify Question
      this.questionType = qtypes.questionType(this.clean);
      this.questionSubType = qtypes.classify(this.lemString);
      this.isQuestion = qtypes.isQuestion(this.raw);

      // TODO: This is currently unused - why?
      // Sentence Sentiment
      this.sentiment = 0;

      // Get Nouns and Noun Phrases.
      this.nouns = this.fetchNouns();
      this.names = this.fetchComplexNouns('names');

      // A list of terms
      // this would return an array of thems this are a, b and c;
      // Helpful for choosing something when the qSubType is CH
      this.list = this.fetchList();
      this.adjectives = this.fetchAdjectives();
      this.adverbs = this.fetchAdverbs();
      this.verbs = this.fetchVerbs();
      this.pronouns = this.pnouns = this.fetchPronouns();
      this.compareWords = this.fetchCompareWords();
      this.numbers = this.fetchNumbers();
      this.compare = this.compareWords.length !== 0;
      this.date = this.fetchDate();

      this.names = _.uniq(this.names, name =>
         name.toLowerCase()
      );

      // Nouns with Names removed.
      const lowerCaseNames = this.names.map(name =>
         name.toLowerCase()
      );

      this.cNouns = _.filter(this.nouns, item =>
         !_.includes(lowerCaseNames, item.toLowerCase())
      );

      this.checkMath();

      // Things are nouns + complex nouns so
      // turkey and french fries would return ['turkey','french fries']
      // this should probably run the list though concepts or something else to validate them more
      // than NN NN etc.
      this.fetchNamedEntities((entities) => {
        const complexNouns = this.fetchComplexNouns('nouns');
        const fullEntities = entities.map(item =>
           item.join(' ')
        );

        this.entities = patchList(fullEntities, complexNouns);
        this.list = patchList(fullEntities, this.list);

        debug.verbose('Message: ', this);
        callback(this);
      });
    });
  }

  // We only want to lemmatize the nouns, verbs, adverbs and adjectives.
  lemma(callback) {
    const itor = function (hash, next) {
      const word = hash[0].toLowerCase();
      const tag = Utils.pennToWordnet(hash[1]);

      // console.log(word, tag);
      // next(null, [word]);

      if (tag) {
        try {
          Lemmer.lemmatize(`${word}#${tag}`, next);
        } catch (e) {
          console.log('Caught in Excption', e);
          // This is probably because it isn't an english word.
          next(null, [word]);
        }
      } else {
        // Some words don't have a tag ie: like, to.
        next(null, [word]);
      }
    };

    async.map(this.taggedWords, itor, (err, lemWords) => {
      const result = _.map(_.flatten(lemWords), lemWord =>
         lemWord.split('#')[0]
      );
      callback(err, result);
    });
  }

  checkMath() {
    let numCount = 0;
    let oppCount = 0;

    for (let i = 0; i < this.taggedWords.length; i++) {
      if (this.taggedWords[i][1] === 'CD') {
        numCount += 1;
      }
      if (this.taggedWords[i][1] === 'SYM' ||
        math.mathTerms.indexOf(this.taggedWords[i][0]) !== -1) {
        // Half is a number and not an opp
        if (this.taggedWords[i][0] === 'half') {
          numCount += 1;
        } else {
          oppCount += 1;
        }
      }
    }

    // Augment the Qtype for Math Expressions
    this.numericExp = (numCount >= 2 && oppCount >= 1);
    this.halfNumericExp = (numCount === 1 && oppCount === 1);

    if (this.numericExp || this.halfNumericExp) {
      this.questionType = 'NUM:expression';
      this.isQuestion = true;
    }
  }

  fetchCompareWords() {
    return this.dict.fetch('pos', ['JJR', 'RBR']);
  }

  fetchAdjectives() {
    return this.dict.fetch('pos', ['JJ', 'JJR', 'JJS']);
  }

  fetchAdverbs() {
    return this.dict.fetch('pos', ['RB', 'RBR', 'RBS']);
  }

  fetchNumbers() {
    return this.dict.fetch('pos', ['CD']);
  }

  fetchVerbs() {
    return this.dict.fetch('pos', ['VB', 'VBN', 'VBD', 'VBZ', 'VBP', 'VBG']);
  }

  fetchPronouns() {
    return this.dict.fetch('pos', ['PRP', 'PRP$']);
  }

  fetchNouns() {
    return this.dict.fetch('pos', ['NN', 'NNS', 'NNP', 'NNPS']);
  }

  // Fetch list looks for a list of items
  // a or b
  // a, b or c
  fetchList() {
    debug.verbose('Fetch list');
    const list = [];
    if (/NNP? CC(?:\s*DT\s|\s)NNP?/.test(this.posString) ||
        /NNP? , NNP?/.test(this.posString) ||
        /NNP? CC(?:\s*DT\s|\s)JJ NNP?/.test(this.posString)) {
      let sn = false;
      for (let i = 0; i < this.taggedWords.length; i++) {
        if (this.taggedWords[i + 1] &&
          (this.taggedWords[i + 1][1] === ',' ||
          this.taggedWords[i + 1][1] === 'CC' ||
          this.taggedWords[i + 1][1] === 'JJ')) {
          sn = true;
        }
        if (this.taggedWords[i + 1] === undefined) {
          sn = true;
        }
        if (sn && Utils.isTag(this.taggedWords[i][1], 'nouns')) {
          list.push(this.taggedWords[i][0]);
          sn = false;
        }
      }
    }
    return list;
  }

  fetchDate() {
    let date = null;
    const months = ['january', 'february', 'march',
      'april', 'may', 'june', 'july', 'august', 'september',
      'october', 'november', 'december'];

    // http://rubular.com/r/SAw0nUqHJh
    const regex = /([a-z]{3,10}\s+[\d]{1,2}\s?,?\s+[\d]{2,4}|[\d]{2}\/[\d]{2}\/[\d]{2,4})/i;
    const match = this.clean.match(regex);

    if (match) {
      debug.verbose('Date: ', match);
      date = moment(Date.parse(match[0]));
    }

    if (this.questionType === 'NUM:date' && date === null) {
      debug.verbose('Try to resolve date');
      // TODO, in x months, x months ago, x months from now
      if (_.includes(this.nouns, 'month')) {
        if (this.dict.includes('next')) {
          date = moment().add('M', 1);
        }
        if (this.dict.includes('last')) {
          date = moment().subtract('M', 1);
        }
      } else if (Utils.inArray(this.nouns, months)) {
        // IN month vs ON month
        const p = Utils.inArray(this.nouns, months);
        date = moment(`${this.nouns[p]} 1`, 'MMM D');
      }
    }

    return date;
  }

  // Pulls concepts from the bigram DB.
  fetchNamedEntities(callback) {
    const bigrams = ngrams.bigrams(this.taggedWords);

    const sentenceBigrams = _.map(bigrams, bigram =>
       _.map(bigram, item => item[0])
    );

    const itor = (item, cb) => {
      const bigramLookup = { subject: item.join(' '), predicate: 'isa', object: 'bigram' };
      this.factSystem.db.get(bigramLookup, (err, res) => {
        if (err) {
          debug.error(err);
        }

        if (!_.isEmpty(res)) {
          cb(err, true);
        } else {
          cb(err, false);
        }
      });
    };

    async.filter(sentenceBigrams, itor, (err, res) => {
      callback(res);
    });
  }

  // This function will return proper nouns and group them together if they need be.
  // This function will also return regular nonus or common nouns grouped as well.
  // Rob Ellis and Brock returns ['Rob Ellis', 'Brock']
  // @tags - Array, Words with POS [[word, pos], [word, pos]]
  // @lookupType String, "nouns" or "names"
  fetchComplexNouns(lookupType) {
    const tags = this.taggedWords;
    const bigrams = ngrams.bigrams(tags);
    let tester;

    // TODO: Might be able to get rid of this and use this.dict to get nouns/proper names
    if (lookupType === 'names') {
      tester = item =>
         item[1] === 'NNP' || item[1] === 'NNPS'
      ;
    } else {
      tester = item =>
         item[1] === 'NN' || item[1] === 'NNS' || item[1] === 'NNP' || item[1] === 'NNPS'
      ;
    }

    const nouns = _.filter(_.map(tags, item =>
       tester(item) ? item[0] : null
    ), Boolean);

    const nounBigrams = ngrams.bigrams(nouns);

    // Get a list of term
    const neTest = _.map(bigrams, bigram =>
       _.map(bigram, item => tester(item))
    );

    // TODO: Work out what this is
    const thing = _.map(neTest, (item, key) =>
       _.every(item, _.identity) ? bigrams[key] : null
    );

    // Return full names from the list
    const fullnames = _.map(_.filter(thing, Boolean), item =>
       (_.map(item, item2 =>
         item2[0]
      )).join(' ')
    );

    debug.verbose(`Full names found from lookupType ${lookupType}: ${fullnames}`);

    const x = _.map(nounBigrams, item =>
       _.includes(fullnames, item.join(' '))
    );

    // FIXME: This doesn't do anything (result not used)
    // Filter X out of the bigrams or names?
    _.filter(nounBigrams, (item, key) => {
      if (x[key]) {
        // Remove these from the names
        nouns.splice(nouns.indexOf(item[0]), 1);
        nouns.splice(nouns.indexOf(item[1]), 1);
        return nouns;
      }
    });

    return nouns.concat(fullnames);
  }
}

export default Message;
