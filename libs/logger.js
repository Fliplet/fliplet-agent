const chalk = require('chalk');

const logger = {};

logger.critical = function (message) {
  console.error(chalk.yellow('[!!!]'), chalk.red(message));
  process.exit(1);
}

global.log = logger;