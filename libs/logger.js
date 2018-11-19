const chalk = require('chalk');
const moment = require('moment');
const Sentry = require('@sentry/node');

const logger = {};

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

  // Windows Service Logger to Event Viewer
if (process.env.SERVICE) {
  const EventLogger = require('node-windows').EventLogger;
  const winlog = new EventLogger('flipletagent.exe');

  console.info = winlog.info;
  console.error = winlog.error;
  console.warn = winlog.warn;
}

logger.error = function (message) {
  console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
}

logger.critical = function (message) {
  console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
  Sentry.captureException(message);
  console.error('A critical error was triggered. Aborting process.');
  process.exit(1);
}

logger.info = function (message) {
  console.error(chalk.green(`[${getDate()}]`), message);
}

logger.debug = function (message) {
  console.error(chalk.green(`[${getDate()}]`), chalk.gray(message));
}

global.log = logger;