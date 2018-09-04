const _ = require('lodash');
const Sequelize = require('sequelize');

const agent = function (config) {
  log.info('Initialising connection with source database');

  this.config = _.extend({
    operatorsAliases: false
  }, config.database);

  this.db = new Sequelize(this.config);

  return this.db.authenticate().then(() => {
    log.info('Connection has been established successfully.');
  }).catch(err => {
    log.critical(`Unable to connect to the database: ${err.message}`);
  });
};

agent.prototype.push = function pushData(config) {
  log.info(`Configured push to dataSource ${config.targetDataSource}.`);
}

agent.prototype.start = function startAgent() {
  log.info('Agent started successfully. Press Ctrl+C to quit.');
  process.stdin.resume();
}

module.exports = agent;