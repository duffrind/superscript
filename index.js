var fs	 		= require("fs");
var rl 			= require("readline");
var async 	= require("async");

var qtypes 	= require("qtypes");
var Message = require("./lib/message");
var Users 	= require("./lib/users");

var getreply 	= require("./lib/getreply");
var processTags = require("./lib/processtags");

var Sort 		= require("./lib/sort");
var Utils 	= require("./lib/utils");

var norm 		= require("node-normalizer");

var requireDir = require('require-dir');

var debug 	= require("debug")("Script");
var dWarn 	= require("debug")("Script:Warning");


function SuperScript() {

	var that = this;
	this._users    	= {}; // 'user' variables
	this._sorted   	= {};
	this._topics   	= {}; // main reply structure
	this._topicFlags = {"random":[]}; 

	this._includes = {}; // included topics
	this._lineage  = {}; // inherited topics
	this._plugins  = [];

	this.normalize = null;
	this.question  = null;

	this.loadPlugins("./plugins");
}

SuperScript.prototype.loadPlugins = function(path) {
	var plugins = requireDir(path);

	for (var file in plugins) {
		for (var func in plugins[file]) {
			this._plugins[func] = plugins[file][func];
		}
	}
}

SuperScript.prototype.loadDirectory = function(path, callback ) {
	
	try {
		var files = fs.readdirSync(path)	
	} catch(error) {
		dWarn("Error Loading Topics", error)
		return callback(error, null);
	}
	
	var toLoad = [];
	var that = this;

	for (var i = 0; i < files.length; i++) {
		if (files[i].match(/\.(ss)$/i)) {
			toLoad.push(path + "/" + files[i]);
		}
	}

	norm.loadData(function(){
		that.normalize = norm;

		var itor = function(item, next) {
			that._loadFile(item);
			next()
		}
		
		new qtypes(function(question) {
			async.each(toLoad, itor, function(){
				that.question = question;
				that.sortReplies();
				callback(null, that);
			});
		});
	});
}

SuperScript.prototype.sortReplies = function(previous) {

	var triglvl, sortlvl;
	if (previous != undefined) {
		triglvl = this._thats;
		sortlvl = 'previous';
	} else {
		triglvl = this._topics;
		sortlvl = 'topics';
	}

	// (Re)initialize the sort cache.
	this._sorted[sortlvl] = {};
	debug("Sorting triggers...");

	var sorter = new Sort(this._includes, this._lineage);

	for (var topic in triglvl) {
		debug("Analyzing topic " + topic);

		var alltrig = sorter.topic_triggers(topic, triglvl);
		var running = sorter._sort_trigger_set(alltrig);

		// Save this topic's sorted list.
		if (!this._sorted[sortlvl]) {
			this._sorted[sortlvl] = {};
		}

		this._sorted[sortlvl][topic] = running;
	}
}

SuperScript.prototype._loadFile = function(file) {
	var that = this;	
	var contents = fs.readFileSync(file, 'utf-8');
	that.parse(file, contents);
}

SuperScript.prototype.parse = function(fileName, code) {
	var that = this;
	var comment = false;
	
	var topic = "random";		// Initial Topic
	var ontrig  = "";       // The current trigger
	var repcnt  = 0;        // The reply counter
	var concnt  = 0;        // The condition counter
	var lineno  = 0;				// Line number for Warning Messages
	var lastcmd = "";       // Last command code
	var isThat  = "";       // Is a %Previous trigger

	var lines = code.split("\n");

	for (var lp = 0; lp < lines.length; lp++) {
		var line = lines[lp];
		var cmd;
		lineno = lp + 1;
		line = Utils.trim(line);

		// Look for comments.
		if (line.indexOf("//") == 0) {
			continue;
		} else if (line.indexOf("/*") == 0) {
			// Start of a multi-line comment.
			if (line.indexOf("*/") > -1) {
				// The end comment is on the same line!
				continue;
			}
			// In a multi-line comment.
			comment = true;
			continue;
		} else if (line.indexOf("*/") > -1) {
			// End of a multi-line comment.
			comment = false;
			continue;
		}

		// Line is a comment or empty
		if (comment || line.length == 0) {
			continue;
		}

		if (line.indexOf(" //") != -1) {
			line = Utils.trim(line.substring(0, line.indexOf(" //")));
		}

		// Separate the command from the data.
		if (line.length < 2) {
			dWarn("Weird single-character line '" + line + "' found", fileName, lineno);
			continue;
		}

		cmd  = line.substring(0, 1);
		line = Utils.trim(line.substring(1));


		// Reset the %Previous state if this is a new +Trigger.
		if (cmd == 'H' || cmd == '+') {
			isThat = "";
		}

		// Do a lookahead for ^Continue and %Previous commands.
		for (var i = lp + 1; i < lines.length; i++) {

			var lookahead = Utils.trim(lines[i]);
			if (lookahead.length < 2) {
				continue;
			}

			var lookCmd = lookahead.substring(0,1);
			lookahead = Utils.trim(lookahead.substring(1));

			// Only continue if the lookahead line has any data.
			if (lookahead.length != 0) {
				// The lookahead command has to be either a % or a ^.
				if (lookCmd != '^' && lookCmd != '%') {
					break;
				}

				// If the current command is a +, see if the following is a %.
				if (cmd == 'H' || cmd == '+') {
					if (lookCmd == '%') {
						isThat = lookahead;
						break;
					} else {
						isThat = '';
					}
				}

				// If the current command is a ! and the next command(s) are
				// ^, we'll tack each extension on as a line break (which is useful information for arrays).
				if (cmd == '!') {
					if (lookCmd == '^') {
						line += "<crlf>" + lookahead;
					}
					continue;
				}

				// If the current command is not a ^, and the line after is
				// not a %, but the line after IS a ^, then tack it on to the
				// end of the current line.
				if (cmd != '^' && lookCmd != '%') {
					if (lookCmd == '^') {
						line += lookahead;
					} else {
						break;
					}
				}
			}
		}

		switch(cmd) {
			case '^': break;
			case '>':
				// > LABEL
				var temp   = Utils.trim(line).split(" ");
				var type   = temp.shift();
				var flags  = type.split(":");
				if (flags.length > 0) {
					type 			= flags[0];
					var nflags = flags.shift();
				}
			
				debug("line: " + line + "; temp: " + temp + "; type: " + type + "; flags: " + flags);
				var name   = '';
				var fields = [];
				if (temp.length > 0) {
					name = temp.shift();
				}
				if (temp.length > 0) {
					fields = temp;
				}

				// Handle the label types.
				if (type == "begin") {
					// The BEGIN block.
					debug("Found the BEGIN block.");
					type = "topic";
					name = "__begin__";

					// This topic is hard-coded to keep
					this._topicFlags["__begin__"] = ["keep"];
				}
				if (type == "topic") {
					// Starting a new topic.
					debug("Set topic to " + name);
					ontrig = '';
					topic  = name;

					if (!this._topicFlags[topic]) {
						this._topicFlags[topic] = [];

					}

					this._topicFlags[topic] = this._topicFlags[topic].concat(flags);
					// This needs to be improved + tested
					// Does this topic include or inherit another one?
					var mode = ''; // or 'inherits' or 'includes'
					if (fields.length >= 2) {
						for (var i = 0; i < fields.length; i++) {
							var field = fields[i];
							if (field == "includes" || field == "inherits") {
								mode = field;
							} else if (mode != '') {
								// This topic is either inherited or included.
								if (mode == "includes") {
									if (!this._includes[name]) {
										this._includes[name] = {};
									}
									this._includes[name][field] = 1;
								} else {
									if (!this._lineage[name]) {
										this._lineage[name] = {};
									}
									this._lineage[name][field] = 1;
								}
							}
						}
					}
				}
				continue;
			case '<':
				// < LABEL
				if (line == "begin" || line == "topic") {
					debug("End the topic label.");
					// Reset the topic back to random
					topic = "random";
				}
				continue;
			case "H":
			case "+":
				debug("Trigger Found", line);
				line = that.normalize.clean(line);
				
				if (isThat.length > 0) {
					this._initTopicTree('thats', topic, isThat, line);
				} else {
					this._initTopicTree('topics', topic, line);
				}
				ontrig = line;
				repcnt = 0;
				concnt = 0;
				continue;

			case "R":
			case "-":
				if (ontrig == '') {
					dWarn("Response found before trigger", fileName, lineno);
					continue;
				}
				debug("Response:", line);

				if (isThat.length > 0) {
					this._thats[topic][isThat][ontrig]['reply'][repcnt] = line;
				} else {
					this._topics[topic][ontrig]['reply'][repcnt] = line;
				}
				repcnt++;
				continue;
			case '@':
				// @ REDIRECT
				debug("Redirect response to: " + line);
				if (isThat.length > 0) {
					this._thats[topic][isThat][ontrig]['redirect'] = Utils.trim(line);
				} else {
					this._topics[topic][ontrig]['redirect'] = Utils.trim(line);
				}
				continue;

			default:
				dWarn("Unknown Command: '" + cmd + "'", fileName, lineno);
		}
	}
	return true;
}


SuperScript.prototype._initTopicTree = function (toplevel, topic, trigger, what) {
	if (toplevel == "topics") {
		if (!this._topics[topic]) {
			this._topics[topic] = {};
		}
		if (!this._topics[topic][trigger]) {
			this._topics[topic][trigger] = {
				'reply':     {},
				'condition': {},
				'redirect':  undefined
			};
		}
	} else if (toplevel == "thats") {
		if (!this._thats[topic]) {
			this._thats[topic] = {};
		}
		if (!this._thats[topic][trigger]) {
			this._thats[topic][trigger] = {};
		}
		if (!this._thats[topic][trigger][what]) {
			this._thats[topic][trigger][what] = {
				'reply':     {},
				'condition': {},
				'redirect':  undefined
			};
		}
	}
};

// Convert msg into message object, then check for a match
SuperScript.prototype.reply = function(userName, msg, callback) {
	if (arguments.length == 2 && typeof msg == "function") {
		callback = msg;
		msg = userName;
		userName = "randomUser";
	}

	debug("Message Recieved from '" + userName + "'", msg);
	var that = this;
	var reply = '';
	var user = Users.findOrCreate(userName);
	var msgObj = new Message(msg, that.question, that.normalize);
	
	user.message = msgObj;

	var options = {
		user: user,
		topicFlags: that._topicFlags,
		sorted: that._sorted, 
		topics: that._topics, 
		plugins: that._plugins,
		step: 0,
		type: "normal"
	}

	// If the BEGIN block exists, consult it first.
	if (that._topics["__begin__"]) {
		debug("begin getreply");
		options.message = new Message("request", that.question, that.normalize);
		options.type = "begin";
		getreply(options,  function(err, begin){
			// Okay to continue?
			if (begin.indexOf("{ok}") > -1) {
				debug("Normal getreply");

				options.message = msgObj;
				options.type = "normal";

				getreply(options, function(err, reply2){
					if (err) {
						callback(err, reply3);
					} else {					
						reply2 = begin.replace(/\{ok\}/g, reply2);	
						var pOptions = {
							user: user, 
							msg: msgObj, 
							reply: reply2, 
							stars: [], 
							botstars:[],
							step: 0, 
							plutins: that._plugins,
							topicFlags: that._topicFlags,
							sorted: that._sorted, 
							topics: that._topics
						};
						processTags(pOptions, function(err, reply3) {
							user.updateHistory(msgObj, reply3);
							callback(err, reply3);
						});
					}
				});
			} else {
				user.updateHistory(msgObj, reply);
				callback(err, reply);
			}
		});		

	} else {

		debug("Normal getreply");
		options.message = msgObj;
		options.type = "normal";
		getreply(options, function(err, reply) {
			if (err) {
				callback(err, null);
			} else {
				user.updateHistory(msgObj, reply);
				callback(err, reply);
			}
		});
	}
}





SuperScript.prototype.getUser = function(userName) {
	return Users.get(userName);
}

module.exports = SuperScript;
