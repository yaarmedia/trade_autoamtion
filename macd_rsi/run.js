const { runMacdRsi } = require('./macdRsiEngine');

runMacdRsi().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
