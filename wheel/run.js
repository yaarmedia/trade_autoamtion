const { runWheel } = require('./wheelEngine');

runWheel().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
