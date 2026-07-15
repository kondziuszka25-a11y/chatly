const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with test accounts...');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  // 1. Create Users
  const user1 = await prisma.user.upsert({
    where: { email: 'adam@example.com' },
    update: {},
    create: {
      username: 'Adam',
      email: 'adam@example.com',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Adam',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'bartosz@example.com' },
    update: {},
    create: {
      username: 'Bartosz',
      email: 'bartosz@example.com',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Bartosz',
    },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'celina@example.com' },
    update: {},
    create: {
      username: 'Celina',
      email: 'celina@example.com',
      passwordHash,
      avatarUrl: 'https://api.dicebear.com/7.x/initials/svg?seed=Celina',
    },
  });

  console.log('Created test users:');
  console.log('- Adam (adam@example.com / password123)');
  console.log('- Bartosz (bartosz@example.com / password123)');
  console.log('- Celina (celina@example.com / password123)');

  // 2. Create a mock conversation between Adam and Bartosz
  const existingConvs = await prisma.conversation.findMany({
    where: {
      isGroup: false,
      members: {
        every: {
          userId: { in: [user1.id, user2.id] }
        }
      }
    },
    include: { members: true }
  });

  const existingConv = existingConvs.find(c => c.members.length === 2);

  if (!existingConv) {
    const conv = await prisma.conversation.create({
      data: {
        isGroup: false,
        members: {
          create: [
            { userId: user1.id },
            { userId: user2.id }
          ]
        }
      }
    });

    // Add some messages
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: user1.id,
        content: 'Cześć Bartosz! Co tam słychać w projekcie?'
      }
    });

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: user2.id,
        content: 'Hej Adam! Wszystko idzie świetnie. Przygotowałem już bazę danych Prisma i Express API.'
      }
    });

    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: user1.id,
        content: 'Super! Wygląda na to, że nasza aplikacja działa w czasie rzeczywistym.'
      }
    });
    console.log('Created private conversation and sample messages between Adam and Bartosz.');
  }

  // 3. Create a Group Conversation
  const existingGroup = await prisma.conversation.findFirst({
    where: {
      isGroup: true,
      name: 'Antygrawitacja'
    }
  });

  if (!existingGroup) {
    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        name: 'Antygrawitacja',
        avatarUrl: 'https://api.dicebear.com/7.x/identicon/svg?seed=Antygrawitacja',
        ownerId: user1.id,
        members: {
          create: [
            { userId: user1.id },
            { userId: user2.id },
            { userId: user3.id }
          ]
        }
      }
    });

    await prisma.message.create({
      data: {
        conversationId: group.id,
        senderId: user1.id,
        content: 'Witajcie na kanale grupy Antygrawitacja!'
      }
    });

    await prisma.message.create({
      data: {
        conversationId: group.id,
        senderId: user3.id,
        content: 'Dzięki za zaproszenie! Cieszę się, że mogę tu być.'
      }
    });
    console.log('Created group "Antygrawitacja" with members: Adam, Bartosz, Celina.');
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
