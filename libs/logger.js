const chalk = require('chalk');
const moment = require('moment');

const logger = {};

function getDate() {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

logger.critical = function (message) {
  console.error(chalk.red(`[${getDate()}]`), chalk.yellow('[ERROR]'), chalk.red(message));
  process.exit(1);
}

logger.info = function (message) {
  console.error(chalk.green(`[${getDate()}]`), message);
}

logger.debug = function (message) {
  console.error(chalk.green(`[${getDate()}]`), chalk.gray(message));
}

global.log = logger;