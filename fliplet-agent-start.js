// Allow self-signed certificates when running as a service
process.env.NODE_NO_WARNINGS = 1;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { Agent, config } = require('./libs/agent-bootstrap');

try {
  (new Agent(config.config)).then(function (agent) {
    config.setup(agent, {
      log
    });
    agent.start();
  }).catch(function (err) {
    log.critical(err);
  });
} catch (e) {
  log.critical(`There was an error running your config file. (Error: ${e.message})`);
}