/** Test all API connections */
import 'dotenv/config';
import { runAllTests } from '../utils/connection-test.js';
import { logger } from '../utils/logger.js';

const log = logger('test-connections');

async function main() {
  log.info('Running connection tests...\n');

  const results = await runAllTests();

  console.log('\n📊 Connection Test Results:\n');
  console.log('─'.repeat(80));

  results.forEach((result) => {
    console.log(`${result.name}: ${result.success ? '✅' : '❌'}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  console.log('\n' + '─'.repeat(80));
  console.log(`\n✅ ${successCount}/${totalCount} connections successful\n`);

  process.exit(successCount === totalCount ? 0 : 1);
}

main().catch((error) => {
  log.error('Fatal error:', error);
  process.exit(1);
});
