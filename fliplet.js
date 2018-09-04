#!/usr/bin/env node

const path = require('path');
const package = require(path.join(__dirname, 'package.json'));
const program = require('commander');

program
  .version(package.version)
  .command('start [pathToConfigFile]', 'Start the agent.')
  .parse(process.argv);