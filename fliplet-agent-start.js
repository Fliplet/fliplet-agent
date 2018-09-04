require('./libs/logger');

const configPath = process.argv[2];
let config;

if (!configPath) {
  log.critical('Path to config file is required');
}

try {
  config = require(configPath);
} catch (e) {
  log.critical(`Cannot read config file. Please check whether the path is correct. (Error: ${e.message})`);
}

if (typeof config !== 'function') {
  log.critical('Your config file does not export a function via module.exports');
}

const agent = require('./libs/agent');

try {
  config(agent);
} catch (e) {
  log.critical(`There was an error running your config file. (Error: ${e.message})`);
}