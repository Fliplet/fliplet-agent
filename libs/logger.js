const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const util = require('util');
const Sentry = require('@sentry/node');
const path = require('path');
const homeDirectory = require('os').homedir();
const logFile = fs.createWriteStream(path.join(homeDirectory, 'fliplet-agent.log'), { flags : 'w' });

const isService = process.env.SERVICE;
const logger = {};
let eventLogger;
let loggerVerbosity = 'debug';

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

// Windows Service Logger to Event Viewer
if (isService) {
  const EventLogger = require('node-windows').EventLogger;
  eventLogger = new EventLogger('Fliplet Agent');
}

logger.setVerbosity = function setVerbosity (verbosity) {
  logger.info(`[LOG] Setting log verbosity to ${verbosity}.`);
  loggerVerbosity = verbosity;
};

logger.error = function (message) {
  message = message.toString();

  logFile.write(`[${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.error(message);
  }

  console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
}

logger.critical = function (message) {
  message = message.toString();
  logFile.write(`[${getDate()}] ${util.format(message)}\r\n`);
  Sentry.captureException(message);

  if (isService) {
    eventLogger.error(message);
  } else {
    console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
  }

  throw new Error(`A critical error was triggered. Aborting process: ${message}`);
}

logger.info = function (message) {
  if (loggerVerbosity !== 'debug' && loggerVerbosity !== 'info') {
    return;
  }

  message = message.toString();
  logFile.write(`[${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.info(message);
  }

  console.error(chalk.green(`[${getDate()}]`), message);
}

logger.debug = function (message) {
  if (loggerVerbosity !== 'debug') {
    return;
  }

  message = message.toString();
  logFile.write(`[${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.info(message);
  }

  console.error(chalk.green(`[${getDate()}]`), chalk.gray(message));
}

global.log = logger;