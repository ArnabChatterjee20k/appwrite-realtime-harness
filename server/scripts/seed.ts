import { runSeed } from '../src/seed.js';

runSeed().then(
  (summary) => {
    console.log('\nSummary:', JSON.stringify(summary, null, 2));
    process.exit(0);
  },
  (err) => {
    console.error('✗ seed failed');
    console.error(err);
    process.exit(1);
  },
);
