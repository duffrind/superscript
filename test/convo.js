var mocha = require("mocha");
var should  = require("should");

var script = require("../index");
var bot = new script();

describe('Super Script Conversation', function(){

 before(function(done){
    bot.loadDirectory("./test/fixtures/convo", function(err, res) {
    	done();
    });
  });

 	describe('Volley', function(){
		
		it("should have volley", function(done) {
			bot.reply("user1", "Can you skip rope?", function(err, reply) {
				bot.getUser("user1").volley.should.eql(0);
				// console.log(bot.getUser("user1"))
				done();
			});
		});

		it("should have volley 1", function(done) {
			bot.reply("user1", "Can you jump rope?", function(err, reply) {
				bot.getUser("user1").volley.should.eql(1);
				bot.getUser("user1").rally.should.eql(1);
				bot.reply("user1", "Have you done it lately?", function(err, reply) {
					bot.getUser("user1").volley.should.eql(0);
					bot.getUser("user1").rally.should.eql(0);
					done();
				});
			});
		});


	});
});