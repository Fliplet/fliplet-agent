require('./libs/logger');

log.info('Parsing configuration options');

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

if (typeof config.config !== 'object') {
  log.critical('Your config file does not export a configuration via module.exports.config');
}

if (typeof config.setup !== 'function') {
  log.critical('Your config file does not export a setup function via module.exports.setup');
}

const Agent = require('./libs/agent');

try {
  (new Agent(config.config)).then(function (agent) {
    config.setup(agent);
    agent.start();
  });
} catch (e) {
  log.critical(`There was an error running your config file. (Error: ${e.message})`);
}