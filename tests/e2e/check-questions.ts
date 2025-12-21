import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const task = await prisma.task.findFirst({
    where: { linearId: 'd85399b4-0706-4dfd-966e-8116a9324eb1' },
    include: { questions: true }
  });

  if (!task) {
    console.log('Task not found');
    return;
  }

  console.log('Task:', task.id);
  console.log('Awaiting PO Answers:', task.awaitingPOAnswers);
  console.log('Questions:', task.questions.length);

  task.questions.forEach((q, i) => {
    console.log(`\n[${i+1}] ${q.answered ? '✅' : '❓'}`);
    console.log(`   Comment ID: ${q.linearCommentId}`);
    console.log(`   Answered: ${q.answered}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
