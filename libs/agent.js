const _ = require('lodash');
const Sequelize = require('sequelize');
const promiseLimit = require('promise-limit');

const API = require('./api');

const series = promiseLimit(1);

const agent = function initAgent(config) {
  log.info('Initialising connection with source database...');

  this.operations = [];
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
    .then((response) => {
      log.info(`Authentication has been verified successfully. You're logged in as ${response.data.user.fullName}.`);
      return this;
    });
};

agent.prototype.schedule = function scheduleOperations() {

};

agent.prototype.runOperation = function runOperation(operation) {
  log.info(`${operation.description}`);

  switch (operation.type) {
    case 'push':
      return this.runPushOperation(operation);
    default:
      log.critical(`Operation "${operation.type}" does not exist. We only support "push" operations for the time being.`);
  }
};

agent.prototype.runPushOperation = function runPushOperation(operation) {
  return this.api.request({
    url: `v1/data-sources/${operation.targetDataSourceId}/data`
  }).catch(function (err) {
    if (err.response.status) {
      log.critical(`You don't have access to the dataSource ${operation.targetDataSourceId}. Please check the permissions of your Fliplet user.`);
    }

    return Promise.reject(err);
  });
};

agent.prototype.run = function runOperations() {
  log.info('Running operations...');

  Promise.all(this.operations.map((operation) => {
    return series(() => this.runOperation(operation))
  })).then(results => {
    log.info('Finished to run all operations');
    process.exit();
  })
};

agent.prototype.push = function pushData(config) {
  config.type = 'push';
  this.operations.push(config);
  log.info(`Configured push to dataSource ${config.targetDataSource}.`);
  return this;
}

agent.prototype.start = function startAgent() {
  log.info('Agent started successfully. Press Ctrl+C to quit.');
  log.info('-------------------------------------------------');
  process.stdin.resume();
  return this.run();
  return this;
}

module.exports = agent;