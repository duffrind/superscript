
/**
  
  A Gambit is a Trigger + Reply or Reply Set
  - We define a Reply as a subDocument in Mongo.

**/

module.exports = function(mongoose, facts) {

  var Utils = require("../utils");
  var regexreply = require("../parse/regexreply");
  var debug = require("debug")("Gambit");
  var norm = require("node-normalizer");
  var _ = require("underscore");

  var findOrCreate = require('mongoose-findorcreate');

  var gNormalizer;

  norm.loadData(function() {
    gNormalizer = norm;
    debug("Normaizer Loaded.")
  });

  // var Reply = require("./reply");


  /**

    I trigger is the matching rule behind a piece of input. It lives in a topic or several topics.
    A trigger also contains one or more replies.

  **/

  var gambitSchema = new mongoose.Schema({
    id: {type: String, index: true, default: Utils.genId()},

    // This is the input string that generates a rule, 
    // In the event we want to export this, we will use this value.
    // Make this filed conditionally required if trigger is supplied
    input: { type: String },

    // The Trigger is a partly baked regex.
    trigger:  {type: String, index: true},

    // If the trigger is a Question Match
    isQuestion: {type: Boolean, default: false},

    // If the trigger is a Answer Type Match
    qType: {type: String, default: ""},
    qSubType: {type: String, default: ""},

    // The filter function for the the expression
    filter: {type: String, default: ""},

    // An array of replies.
    replies: [{ type: String, ref: 'Reply' }],
    
    // replies: [Reply.schema],

    // This will redirect anything that matches elsewhere.
    // If you want to have a conditional rediect use reply redirects
    // TODO, change the type to a ID and reference another gambit directly
    // this will save us a lookup down the road (and improve performace.)
    redirect: {type: String, default: ""}
  });

  gambitSchema.pre('save', function (next) {
    var that = this;

    that.replies = _.uniq(that.replies, function(item, key, id) { 
      return item.id;
    });

    // If input was supplied, we want to use it to generate the trigger
    if (that.input && !that.trigger) {
      var input = gNormalizer.clean(this.input);
      
      // We want to convert the input into a trigger.
      regexreply.parse(input, facts, function(trigger) {
        that.trigger = trigger;
        next();
      });      
    } else {
      // Otherwise we populate the trigger normally
      next();
    }
  });

  gambitSchema.methods.doesMatch = function(obj, cb) {
    var re = new RegExp('^' + this.trigger + '$', "i")
    var valid = re.test(obj.clean);
    cb(null, valid)
  }

  gambitSchema.plugin(findOrCreate);

  try {
    return mongoose.model('Gambit', gambitSchema);
  } catch(e) {
    return mongoose.model('Gambit');
  }
}