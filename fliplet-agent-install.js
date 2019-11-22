const os = require('os');
const path = require('path');

let packageName;

switch (os.platform()) {
  case 'win32':
    packageName = 'node-windows';
    break;
  case 'darwin':
    packageName = 'node-mac';
    break;
  default:
    throw new Error('OS not supported');
}

const Service = require(packageName).Service;

const { Agent, config } = require('./libs/agent-bootstrap');

try {
  (new Agent(config.config)).then(function (agent) {
    config.setup(agent, {
      log
    });

    if (!agent.operations.length) {
      console.error('No operations have been defined.');
    }

    const fileName = path.basename(config.path).split('.')[0];
    const description = agent.operations[0].description;

    log.info(`Registering operation ${description} for file ${fileName}`);

    // Create a new service object
    const svc = new Service({
      name: `Fliplet Agent (${fileName})`,
      description,
      script: require('path').join(__dirname, 'fliplet-agent-start.js'),
      workingdirectory: require('path').join(__dirname, 'fliplet-agent-start.js'),
      env: [
        {
          name: 'CFGPATH',
          value: config.path
        },
        {
          name: 'SERVICE',
          value: true
        }
      ],
      nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
      ]
    });

    svc.on('error', console.error);

    // Listen for the "install" event, which indicates the
    // process is available as a service.
    svc.on('install',function(){
      console.log('The agent has been installed successfully. You can see the logs in the Event Viewer under "Windows Logs" > "Application" for the source "flipletagent.exe"');
      svc.start();
    });

    svc.install();

  }).catch(function (err) {
    log.critical(err);
  });
} catch (e) {
  log.critical(`There was an error running your config file. (Error: ${e.message})`);
}