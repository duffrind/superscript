var script = require("../index");
var sfact = require("sfacts");
var fs = require("fs");
var rmdir = require("rmdir");
var async = require("async");
  
var mongoDB, mongoose, cnet, data, botData;
mongoose = require("mongoose");
cnet = require("conceptnet")({host:'127.0.0.1', user:'root', pass:''});

data = [
  // './test/fixtures/concepts/bigrams.tbl', // Used in Reason tests
  // './test/fixtures/concepts/trigrams.tbl', 

  // './test/fixtures/concepts/concepts.top',
  // './test/fixtures/concepts/verb.top', 
  // './test/fixtures/concepts/color.tbl', 
  // './test/fixtures/concepts/opp.tbl'
];

botData = [
  './test/fixtures/concepts/botfacts.tbl',
  './test/fixtures/concepts/botown.tbl'
];

exports.bootstrap = bootstrap = function(cb) {
  sfact.load(data, 'factsystem', function(err, facts){
    gFacts = facts;
    cb(null, facts);
  });
}

exports.after = function(done) {

  var itor = function(item, cb) {
    fs.exists(item, function (exists) {
      if (exists) { 
        rmdir(item, cb); 
      } else {
        cb();
      }
    });
  }

  bot.factSystem.db.close(function(){
    // Kill the globals
    gFacts = null;
    bot = null;
    async.each(['./factsystem', './systemDB'], itor, function(){
      delete mongoose.connection.models['Topic'];
      delete mongoose.connection.models['Gambit'];
      delete mongoose.connection.models['User'];
      mongoose.connection.models = {};

      mongoDB.connection.db.dropDatabase(function(){
        mongoose.connection.close();
        done();
      });
    });
  });  
}

var TopicSystem = require("../lib/topics/index"); 

var imortFilePath = function(path, facts, callback) {
  var importFile = TopicSystem(facts).importer;
  importFile(path, callback);    
}

exports.before = function(file) {

  var options = { 
    scope: {
      cnet : cnet
    }
  }

  return function(done) {
    mongoDB = mongoose.connect("mongodb://localhost/superscriptDB");

    var fileCache = './test/fixtures/cache/'+ file +'.json';
    fs.exists(fileCache, function (exists) {

      if (!exists) {
        bootstrap(function(err, facts) {
          var parse = require("../lib/parse/")(facts);
          parse.loadDirectory('./test/fixtures/' + file, function(err, result) {
            options['factSystem'] = facts;
            // options['mongoConnection'] = mongoDB;
            fs.writeFile(fileCache, JSON.stringify(result), function (err) {

              // Load the topic file into the MongoDB
              imortFilePath(fileCache, facts, function() {
                new script(fileCache, options, function(err, botx) {
                  bot = botx;
                  done();
                });
              });
            });
          });
        });
      } else {
        console.log("Loading Cached Script");
        var contents = fs.readFileSync(fileCache, 'utf-8');
        var contents = JSON.parse(contents);
        
        
        bootstrap(function(err, facts) {
          options['factSystem'] = facts;
          options['mongoConnection'] = mongoDB;

          var sums = contents.checksums;
          var parse = require("../lib/parse/")(facts);
          parse.loadDirectory('./test/fixtures/' + file, sums, function(err, result) {
            parse.merge(contents, result, function(err, results) {

              fs.writeFile(fileCache, JSON.stringify(results), function (err) {
                facts.createUserDBWithData('botfacts', botData, function(err, botfacts){
                  options['botfacts'] = botfacts;
                  bot = null;
                  imortFilePath(fileCache, facts, function() {
                    new script(fileCache, options, function(err, botx) {
                      bot = botx;
                      done();
                    }); // new bot
                  }); // import file
                }); // create user
              }); // write file
            }); // merged parsed data
          }); // Load files to parse
        });
      }
    });
  }
}
