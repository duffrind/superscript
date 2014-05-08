var debug   = require("debug")("User");
var dWarn 	= require("debug")("User:Warning");

Users = {
	_users: [],

	findOrCreate : function(userName) {
		if (this._users[userName] == undefined) {
			this._users[userName] = new User(userName);
		}
		return this._users[userName];
	}, 

	get: function(userName) {
		return this._users[userName];		
	}
}

function User(name) {
	this.name = name;
	this.currentTopic = "random";
	this.pendingTopic;
	this['__history__'] = { 'input': new Array(30), 'reply': new Array(30), 'topic': new Array(30) };
}

User.prototype.setTopic = function(topic) {
	debug("setTopic", topic);
	this.pendingTopic = topic;
}

User.prototype.getTopic = function() {
	// var topic = this.topics[this.topics.length - 1];
	// debug("getTopic", topic);
	return this.currentTopic;
}

// This will keep the last
// This is saved when the message is finally delivered.
User.prototype.updateHistory = function(msg, reply) {
	debug("Updating History");
	this['__history__']["input"].pop();
	this['__history__']["input"].unshift(msg);
	this['__history__']["reply"].pop();
	this['__history__']["reply"].unshift(reply);
	this['__history__']["topic"].pop();
	this['__history__']["topic"].unshift(this.getTopic());

	if (this.pendingTopic != "") {
		this.currentTopic = this.pendingTopic;
	}


}


module.exports = Users;