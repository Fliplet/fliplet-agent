const _ = require('lodash');
const Sequelize = require('sequelize');

const agent = function initAgent(config) {
  log.info('Initialising connection with source database');

  this.config = _.extend({
    operatorsAliases: false,
    logging(query) {
      log.debug(`[QUERY] ${query}`);
    }
  }, config.database);

  this.db = new Sequelize(this.config.url, this.config);

  return this.db.authenticate().then(() => {
    log.info('Connection has been established successfully.');
    return this;
  }).catch(err => {
    log.critical(`Unable to connect to the database: ${err.message}`);
  });
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