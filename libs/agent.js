const agent = function (config) {
  log.info('Initialising connection');
};

agent.prototype.push = function pushData(config) {
  log.info(`Configured push to dataSource ${config.targetDataSource}.`);
}

agent.prototype.start = function startAgent() {
  log.info('Agent is starting');
}

module.exports = agent;