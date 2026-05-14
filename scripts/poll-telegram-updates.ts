import { prisma } from '../lib/prisma';
import { pollTelegramUpdates } from '../lib/telegram-poll';

pollTelegramUpdates()
  .then((result) => {
    console.log(`Telegram poll complete: ${result.processed} processed, ${result.failed} failed, ${result.fetched} fetched.`);
  })
  .catch((error) => {
    console.error('Telegram poll failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
