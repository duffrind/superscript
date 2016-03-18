var mocha = require("mocha");
var should  = require("should");
var help = require("./helpers");

// This test needs to be manually run.
// We done the frist block to create the DB
// then the second to check to see if it works,
// I found this less work then figuring out how to setup a new
// process to spawn each block.
// In this suite, the after hook does not delete the DB
// so that will have to be torn down manually.

describe('Super Script User Persist', function(){

  before(help.before("user"));

  describe('Get a list of users', function(){
    it("should return all users", function(done){
      bot.reply("userx", "hello world", function(err, reply){
        bot.getUsers(function(err, list){
          list.should.not.be.empty;
          done();
        });
      });
    });
  });

  describe('Should save users session', function(){

    it("should save user session", function(done) {
      bot.reply("iuser3", "Save user token ABCD.", function(err, reply) {
        reply.string.should.eql("User token ABCD has been saved.");
        done();
      });
    });

    it("it remember my name", function(done) {
      // Call startup again (same as before hook)
      bot.reply("iuser3", "Get user token", function(err, reply) {
        reply.string.should.eql("Return ABCD");
        done();
      });
    });
  });

  after(help.after);


});