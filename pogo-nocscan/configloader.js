var _       = require("lodash");
var fs      = require("fs");

// Get a file list.
var files = fs.readdirSync('./', {encoding: 'utf-8'});
var config = [];

// Iterate over all files.
_.each(files, function(file) {
    // If this is a config file, load it and push the result into the config array.
    if(file.startsWith("config.") && file.endsWith(".js")) {
        var loadedConf = require(file);

        if(loadedConf instanceof Array) 
            _.each(loadedConf, function(item) { config.push(item); });
        else
            config.push(loadedConf);
    }
})

module.exports = config;