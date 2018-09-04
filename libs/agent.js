const _ = require('lodash');
const Sequelize = require('sequelize');

const API = require('./api');

const agent = function initAgent(config) {
  log.info('Initialising connection with source database...');

  this.config = config;

  // Extend db settings
  this.config.database = _.extend({
    operatorsAliases: false,
    logging(query) {
      log.debug(`[QUERY] ${query}`);
    }
  }, this.config.database);

  // Init connections
  this.db = new Sequelize(this.config.database.url, this.config.database);
  this.api = new API(this.config.authToken);

  return this.db.authenticate()
    .catch(err => {
      log.critical(`Unable to connect to the database: ${err.message}`);
    })
    .then(() => {
      log.info('Connection has been established successfully.');
      log.info('Authenticating with Fliplet API...');

      return this.api.authenticate();
    })
    .catch(err => {
      log.critical(`Unable to authenticate with Fliplet API: ${err.message}`);
    })
    .then(() => {
      log.info('Authentication has been verified successfully.');
      return this;
    })
};

agent.prototype.push = function pushData(config) {
  log.info(`Configured push to dataSource ${config.targetDataSource}.`);
  return this;
}

agent.prototype.start = function startAgent() {
  log.info('Agent started successfully. Press Ctrl+C to quit.');
  process.stdin.resume();
  return this;
}

module.exports = agent;