const chalk = require('chalk');
const moment = require('moment');
const fs = require('fs');
const util = require('util');
const Sentry = require('@sentry/node');
const path = require('path');
const homeDirectory = require('os').homedir();
const logFilePath = path.join(homeDirectory, 'fliplet-agent.log');
const logFile = fs.createWriteStream(logFilePath, { flags : 'a' });

const isService = process.env.SERVICE;
const logger = {};
let eventLogger;
let loggerVerbosity = 'debug';

const fileName = path.basename(process.env.CFGPATH || process.argv[2] || 'File').split('.')[0];

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

// Windows Service Logger to Event Viewer
if (isService) {
  const EventLogger = require('node-windows').EventLogger;
  eventLogger = new EventLogger(`Fliplet Agent (${fileName})`);
}

logger.setVerbosity = function setVerbosity (verbosity) {
  logger.info(`[LOG] Setting log verbosity to ${verbosity}.`);
  loggerVerbosity = verbosity;
};

logger.error = function (message) {
  message = message.toString();

  logFile.write(`[${fileName}] [${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.error(message);
  }

  console.error(`[${fileName}]`, chalk.red(`[${getDate()}]`), chalk.bgRed('[ERROR]'), chalk.red(message));
}

logger.warn = function (message) {
  message = message.toString();

  logFile.write(`[${fileName}] [${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.error(message);
  }

  console.error(`[${fileName}]`, chalk.yellow(`[${getDate()}]`), chalk.red('[WARN]'), chalk.yellow(message));
}

logger.critical = function (message) {
  message = message.toString();
  logFile.write(`[${fileName}] [${getDate()}] ${util.format(message)}\r\n`);
  Sentry.captureException(message);

  if (isService) {
    eventLogger.error(message);
  } else {
    console.error(`[${fileName}]`, chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
  }

  throw new Error(`A critical error was triggered. Aborting process: ${message}`);
}

logger.info = function (message) {
  if (loggerVerbosity !== 'debug' && loggerVerbosity !== 'info') {
    return;
  }

  message = message.toString();
  logFile.write(`[${fileName}] [${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.info(message);
  }

  console.info(`[${fileName}]`, chalk.green(`[${getDate()}]`), message);
}

logger.debug = function (message) {
  if (loggerVerbosity !== 'debug') {
    return;
  }

  message = message.toString();
  logFile.write(`[${fileName}] [${getDate()}] ${util.format(message)}\r\n`);

  if (isService) {
    return eventLogger.info(message);
  }

  console.info(`[${fileName}]`, chalk.green(`[${getDate()}]`), chalk.gray(message));
}

logger.info(`[LOG] A log file for all produced output can be found at ${logFilePath}`);

global.log = logger;