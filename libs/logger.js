const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const util = require('util');
const Sentry = require('@sentry/node');
const logFile = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});

const isService = process.env.SERVICE;
const logger = {};
let eventLogger;

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

// Windows Service Logger to Event Viewer
if (isService) {
  const EventLogger = require('node-windows').EventLogger;
  eventLogger = new EventLogger('Fliplet Agent');
}

logger.error = function (message) {
  logFile.write(util.format(message) + '\n');

  if (isService) {
    return eventLogger.error(message);
  }

  console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
}

logger.critical = function (message) {
  logFile.write(util.format(message) + '\n');
  Sentry.captureException(message);

  if (isService) {
    eventLogger.error(message);
  } else {
    console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
    console.error('A critical error was triggered. Aborting process.');
  }

  process.exit(1);
}

logger.info = function (message) {
  logFile.write(util.format(message) + '\n');

  if (isService) {
    return eventLogger.info(message);
  }

  console.error(chalk.green(`[${getDate()}]`), message);
}

logger.debug = function (message) {
  logFile.write(util.format(message) + '\n');

  if (isService) {
    return eventLogger.info(message);
  }

  console.error(chalk.green(`[${getDate()}]`), chalk.gray(message));
}

global.log = logger;