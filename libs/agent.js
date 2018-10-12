const _ = require('lodash');
const Sequelize = require('sequelize');
const promiseLimit = require('promise-limit');
const moment = require('moment');
const Sentry = require('@sentry/node');
const CronJob = require('cron').CronJob;

const API = require('./api');

const series = promiseLimit(1);

const agent = function initAgent(config) {
  log.info('Initialising connection with source database...');

  this.operations = [];

  this.config = _.extend({
    isDryRun: false,
    syncOnInit: true
  }, config);

  // Extend db settings
  this.config.database = _.extend({
    operatorsAliases: false,
    logging(query) {
      log.debug(`[QUERY] ${query}`);
    }
  }, this.config.database);

  // Init connections
  this.db = this.config.database.url
    ? (new Sequelize(this.config.database.url, this.config.database))
    : (new Sequelize(this.config.database));

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

      Sentry.configureScope((scope) => {
          'id', 'email', 'auth_token', 'firstName', 'lastName'
        ]));
      });

      return this;
    });
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
  const primaryKey = operation.primaryColumnName;
  const timestampKey = operation.timestampColumnName;

  if (!primaryKey) {
    log.error('Warning: A primary key has not been set, which means rows will always be appended to the data source whenever this script runs. To allow updating rows, please define a primary key to be used for the comparison.');
  }

  log.info('Fetching data via Fliplet API...');

  return this.api.request({
    url: `v1/data-sources/${operation.targetDataSourceId}/data`
  }).then((response) => {
    const entries = response.data.entries;
    log.debug(`Fetched ${entries.length} entries from the data source.`);
    log.info('Fetching data from the database...');

    if (typeof operation.sourceQuery !== 'function') {
      log.critical('Source query is not defined');
    }

    return operation.sourceQuery(this.db).then((result) => {
      const rows = result[0];

      log.debug(`Fetched ${rows.length} rows from the database.`);

      const commits = [];
      const toDelete = [];

      if (operation.deleteColumnName) {
        log.debug(`Delete mode is enabled for rows having "${operation.deleteColumnName}" not null.`);
      }

      rows.forEach((row) => {
        if (!primaryKey) {
          log.debug(`Row #${id} has been marked for inserting since we don't have a primary key for the comparison.`);
          return commits.push({
            data: row
          });
        }

        const id = row[primaryKey];
        const isDeleted = operation.deleteColumnName && row[operation.deleteColumnName];

        if (!id) {
          log.error(`A row is missing its primary key value from the database. Skipping: ${JSON.stringify(row)}`);
          return Promise.resolve();
        }

        const entry = _.find(entries, (e) => {
          return e.data[primaryKey] === id;
        });

        if (!entry) {
          if (isDeleted) {
            log.debug(`Row #${id} is not present on Fliplet servers and it's locally marked as deleted. Skipping...`);
          }

          log.debug(`Row #${id} has been marked for inserting.`);
          return commits.push({
            data: row
          });
        }

        if (!timestampKey) {
          log.debug(`Row #${id} already exists on Fliplet servers.`);
        }

        if (isDeleted) {
          log.debug(`Row #${id} has been marked for deletion.`);
          return toDelete.push(id);
        }

        const sourceTimestamp = row[timestampKey];
        const targetTimestamp = entry.data[timestampKey];

        const diff = moment(sourceTimestamp).diff(moment(targetTimestamp), 'seconds');

        if (!diff) {
          return log.debug(`Row #${id} already exists on Fliplet servers and does not require updating.`);
        }

        log.debug(`Row #${id} has been marked for updating.`);
        return commits.push({
          id: entry.id,
          data: row
        });
      });

      if (!commits.length && !toDelete.length) {
        log.info('Nothing to commit.');
        return Promise.resolve();
      }

      if (this.config.isDryRun) {
        log.info('Dry run mode is enabled. Here\'s a dump of the commit log we would have been sent to the Fliplet API:');
        log.info(JSON.stringify(commits, null, 2));

        if (operation.deleteColumnName && toDelete.length) {
          log.info('Entries to delete: ' + JSON.stringify(toDelete, null, 2));
        }

        log.debug('[!] If you don\'t know what the above means, please get in touch with us! We\'re here to help.');
        return;
      }

      return this.api.request({
        method: 'POST',
        url: `v1/data-sources/${operation.targetDataSourceId}/commit`,
        data: {
          append: true,
          entries: commits,
          delete: operation.deleteColumnName ? toDelete : undefined
        }
      }).then((res) => {
        log.info(`Sync finished. ${res.data.entries.length} data source entries have been affected.`);
      });
    }).catch((err) => {
      log.critical(`Cannot execute database query: ${err.message}`);
    });
  }).catch((err) => {
    if (!err.response) {
      log.critical(err);
    }

    if (err.response.status) {
      log.critical(`You don't have access to the dataSource ${operation.targetDataSourceId}. Please check the permissions of your Fliplet user.`);
    }

    return Promise.reject(err);
  });
};

agent.prototype.run = function runOperations() {
  const initRun = this.config.syncOnInit
    ? Promise.all(this.operations.map((operation) => {
        return series(() => this.runOperation(operation))
      })).then(() => {
        if (this.operations.length > 1) {
          log.info('Finished to run all operations.');
        }
      })
    : Promise.resolve();

  initRun.then(() => {
    const withFrequency = _.filter(this.operations, (o) => !!o.frequency);

    if (!withFrequency.length) {
      return process.exit();
    }

    if (this.config.isDryRun) {
      log.info('Dry run finished. Aborting process.');
      return process.exit();
    }

    log.info(`Scheduling ${this.operations.length} operation(s) to run with their set frequency...`);

    withFrequency.forEach((operation) => {
      new CronJob(
        operation.frequency,
        () => {
          this.runOperation(operation)
        },
        null, // onComplete
        true, // start
        null, // timezone
        null, // context
        null  // runOnInit
      );
    });

    log.info(`Scheduling complete. Keep this process alive and you're good to go!`);
  });
};

agent.prototype.push = function pushData(config) {
  config.type = 'push';
  this.operations.push(config);
  log.info(`Configured push to dataSource ${config.targetDataSourceId}.`);
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