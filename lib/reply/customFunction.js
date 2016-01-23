var Utils = require("../utils");
var async = require("async");
var debug = require("debug")("Reply:customFunction");

module.exports = function (reply, match, options, callback) {
  
  var plugins = options.system.plugins;
  var scope = options.system.scope;
  var localOptions = options.localOptions;

  scope.message_props = localOptions.messageScope;
  scope.message = localOptions.message;
  scope.user = localOptions.user;

  var mbit = null;

  // We use async to capture multiple matches in the same reply
  return async.whilst(
    function () {
      return match;
    },
    function (cb) {
      // Call Function here

      var main = match[0];
      var pluginName = Utils.trim(match[1]);
      var partsStr = Utils.trim(match[2]);
      var parts = partsStr.split(",");

      var args = [];
      for (var i = 0; i < parts.length; i++) {
        if (parts[i] !== "") {
          args.push(Utils.decodeCommas(parts[i].trim()));
        }
      }

      if (plugins[pluginName]) {

        // SubReply is the results of the object coming back
        // TODO. Subreply should be optional and could be undefined, or null
        args.push(function customFunctionHandle(err, subreply, matchBit) {

          match = false;
          reply = reply.replace(main, subreply);
          match = reply.match(/\^(\w+)\(([~\w<>,\s]*)\)/);
          mbit = matchBit;
          if (err) {
            cb(err);
          } else {
            cb();
          }
        });

        debug("Calling Plugin Function", pluginName);
        plugins[pluginName].apply(scope, args);

      } else if (pluginName === "topicRedirect" || pluginName === "respond") {
        debug("Existing, we have a systemFunction", pluginName);
        match = false;
        cb(null, "");
      } else {
        // If a function is missing, we kill the line and return empty handed
        debug("Custom Function not-found", pluginName);
        match = false;
        cb(true, "");
      }
    },
    function (err) {
      debug("Callback from custom function", err);
      return callback(err, reply, scope.message.props, {}, mbit);
    }
  );
};
