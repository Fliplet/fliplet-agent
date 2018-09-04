const chalk = require('chalk');
const moment = require('moment');

const logger = {};

logger.critical = function (message) {
  console.error(chalk.yellow('[ERROR]'), chalk.red(message));
  process.exit(1);
}

logger.info = function (message) {
  console.error(chalk.green(`[${moment().format('YYYY-MM-DD HH:mm:ss')}]`), message);
}

global.log = logger;