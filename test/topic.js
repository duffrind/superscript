var mocha = require("mocha");
var should  = require("should");

var script = require("../index");
var bot = new script();

describe.only('Super Script Topics', function(){

 before(function(done){
    bot.loadDirectory("./test/fixtures", function(err, res) {
    	done();
    });
  })

	describe('Topics', function(){
		it("should continue onto the next line", function(done){
			bot.reply("user1", "topic change", function(err, reply) {
				reply.should.eql("Okay we are going to test2");
				bot.getUser("user1").topic.should.eql("test2");
				
				bot.reply("user1", "lets talk about testing", function(err, reply) {
					reply.should.eql("topic test pass");
					
					done();
				});
			});
		});

		
		it("should not repeat itself", function(done){

			bot.reply("user1", "set topic to dry", function(err, reply) {
				// Now in dry topic
				Object.keys(bot._topics).should.have.length(4)
				bot.getUser("user1").topic.should.eql("dry");

				bot.reply("user1", "i have one thing to say", function(err, reply) {
					reply.should.eql("dry topic test pass");

					// Say it again...
					bot.reply("user1", "i have one thing to say", function(err, reply) {
						// If something was said, we don't say it again
						reply.should.eql("");
						done();
					});
				});

			});
		});		
	});


});