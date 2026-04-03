import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed LLM providers
  await prisma.llmProvider.upsert({
    where: { name: 'gemini' },
    update: {},
    create: {
      name: 'gemini',
      default_url: 'https://generativelanguage.googleapis.com/v1beta',
    },
  });

  await prisma.llmProvider.upsert({
    where: { name: 'openai' },
    update: {},
    create: {
      name: 'openai',
      default_url: 'https://api.openai.com/v1',
    },
  });

  await prisma.llmProvider.upsert({
    where: { name: 'custom' },
    update: {},
    create: {
      name: 'custom',
      default_url: 'https://your-custom-endpoint.com/v1',
    },
  });

  console.log('✅ Seed complete');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
