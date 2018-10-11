const yaml = require('js-yaml');
const fs = require('fs');

require('./libs/logger');

log.info('Parsing configuration options');

const configPath = process.argv[2];
const isDryRun = process.argv.indexOf('--test') !== -1;
let config;

if (!configPath) {
  log.critical('Path to config file is required');
}

if (isDryRun) {
  log.info('Dry run enabled. No data will actually be sent to Fliplet server.');
}

try {
  if (/\.js$/.test(configPath)) {
    log.debug('Parsing Javascript configuration file...');

    // JS configuration file
    config = require(configPath);
  } else {
    log.debug('Parsing YML configuration file...');

    const doc = yaml.safeLoad(fs.readFileSync(configPath, 'utf8'));

    config = {
      config: {
        isDryRun: isDryRun,
        authToken: doc.auth_token,
        database: {
          dialect: doc.database_driver,
          host: doc.database_host,
          username: doc.database_username,
          password: doc.database_password,
          port: doc.database_port,
          database: doc.database_name,
          dialectOptions: {
            domain: doc.database_domain,
            instanceName: doc.database_instance,
            encrypt: doc.database_encrypt
          }
        }
      },
      setup(agent) {
        const operation = doc.type || 'push';

        if (!agent[operation]) {
          log.critical(`Operation ${operation} is not supported.`);
        }

        agent[operation]({
          description: doc.description,
          frequency: doc.frequency,
          sourceQuery: (db) => db.query(doc.query),
          primaryColumnName: doc.primary_column,
          timestampColumnName: doc.timestamp_column,
          targetDataSourceId: doc.datasource_id
        });
      }
    };
  }
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
  }).catch(function (err) {
    log.critical(err);
  });
} catch (e) {
  log.critical(`There was an error running your config file. (Error: ${e.message})`);
}