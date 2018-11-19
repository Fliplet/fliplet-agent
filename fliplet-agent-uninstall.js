const Service = require('node-windows').Service;

const { Agent, config } = require('./libs/agent-bootstrap');

// Create a new service object
const svc = new Service({
  name: 'Fliplet Agent',
  script: require('path').join(__dirname, 'fliplet-agent-start.js')
});

svc.on('error', console.error);

// Listen for the "uninstall" event so we know when it's done.
svc.on('uninstall', function (){
  console.info('Uninstall complete.');
  process.exit();
});

// Uninstall the service.
svc.uninstall();

process.stdin.resume();