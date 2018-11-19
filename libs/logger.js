const chalk = require('chalk');
const moment = require('moment');
const Sentry = require('@sentry/node');

const isService = process.env.SERVICE;
const logger = {};
let eventLogger;

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

  // Windows Service Logger to Event Viewer
if (isService) {
  const EventLogger = require('node-windows').EventLogger;
  eventLogger = new EventLogger('flipletagent.exe');
}

logger.error = function (message) {
  if (isService) {
    return eventLogger.error(message);
  }

  console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
}

logger.critical = function (message) {
  if (isService) {
    eventLogger.error(message);
  } else {
    console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
  }

  Sentry.captureException(message);
  console.error('A critical error was triggered. Aborting process.');
  process.exit(1);
}

logger.info = function (message) {
  if (isService) {
    return eventLogger.info(message);
  }

  console.error(chalk.green(`[${getDate()}]`), message);
}

logger.debug = function (message) {
  if (isService) {
    return eventLogger.info(message);
  }

  console.error(chalk.green(`[${getDate()}]`), chalk.gray(message));
}

global.log = logger;