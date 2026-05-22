import prisma from './db';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('Starting database seeding...');

  // Clear existing data
  await prisma.task.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Existing database tables cleared.');

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('password123', salt);

  // 1. Create Users
  const alex = await prisma.user.create({
    data: {
      email: 'admin@ethara.ai',
      password: hashedPassword,
      name: 'Alex Admin',
    },
  });

  const sarah = await prisma.user.create({
    data: {
      email: 'sarah@ethara.ai',
      password: hashedPassword,
      name: 'Sarah Designer',
    },
  });

  const james = await prisma.user.create({
    data: {
      email: 'james@ethara.ai',
      password: hashedPassword,
      name: 'James Developer',
    },
  });

  const elena = await prisma.user.create({
    data: {
      email: 'elena@ethara.ai',
      password: hashedPassword,
      name: 'Elena QA',
    },
  });

  console.log('Sample users created successfully.');

  // 2. Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Ethara AI Platform v1.0',
      description: 'Developing the next generation AI-powered collaboration workspace with modern glassmorphism UI.',
    },
  });

  console.log('Sample project created.');

  // 3. Add Members to Project
  await prisma.projectMember.createMany({
    data: [
      { projectId: project.id, userId: alex.id, role: 'ADMIN' },
      { projectId: project.id, userId: sarah.id, role: 'MEMBER' },
      { projectId: project.id, userId: james.id, role: 'MEMBER' },
      { projectId: project.id, userId: elena.id, role: 'MEMBER' },
    ],
  });

  console.log('Project memberships added.');

  // 4. Create Sample Tasks
  const now = new Date();
  
  const d2Ago = new Date();
  d2Ago.setDate(now.getDate() - 2);
  
  const d1Ago = new Date();
  d1Ago.setDate(now.getDate() - 1);

  const d3Ahead = new Date();
  d3Ahead.setDate(now.getDate() + 3);

  const d2Ahead = new Date();
  d2Ahead.setDate(now.getDate() + 2);

  const d5Ahead = new Date();
  d5Ahead.setDate(now.getDate() + 5);

  const d6Ahead = new Date();
  d6Ahead.setDate(now.getDate() + 6);

  await prisma.task.createMany({
    data: [
      {
        title: 'Design Glassmorphism Dashboard Mockups',
        description: 'Create high-fidelity dark glassmorphism designs for the main kanban board and dashboard widgets.',
        status: 'DONE',
        priority: 'HIGH',
        dueDate: d2Ago,
        projectId: project.id,
        creatorId: alex.id,
        assigneeId: sarah.id,
      },
      {
        title: 'Setup Express API & SQLite Database Schema',
        description: 'Initialize project workspace, configure Prisma ORM with SQLite, and define initial relational schemas.',
        status: 'DONE',
        priority: 'HIGH',
        dueDate: d1Ago,
        projectId: project.id,
        creatorId: alex.id,
        assigneeId: james.id,
      },
      {
        title: 'Implement JWT Authentication & RBAC Middleware',
        description: 'Secure API endpoints with JSON Web Tokens and write custom middleware to restrict workspace features based on user roles.',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: d3Ahead,
        projectId: project.id,
        creatorId: alex.id,
        assigneeId: james.id,
      },
      {
        title: 'Refine CSS Animations & Custom Transitions',
        description: 'Implement smooth page loads, card translations, hover triggers, and dynamic orb blur shifts using vanilla CSS.',
        status: 'REVIEW',
        priority: 'MEDIUM',
        dueDate: d2Ahead,
        projectId: project.id,
        creatorId: alex.id,
        assigneeId: sarah.id,
      },
      {
        title: 'Write Unit and Integration Tests for API Routes',
        description: 'Ensure backend robustness by writing extensive mock API requests and checking response codes/roles validation.',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: d5Ahead,
        projectId: project.id,
        creatorId: alex.id,
        assigneeId: elena.id,
      },
      {
        title: 'Verify Access Control Enforcement on Task Deletions',
        description: 'Manually test and confirm that regular project members are strictly blocked from deleting any board task.',
        status: 'TODO',
        priority: 'LOW',
        dueDate: d6Ahead,
        projectId: project.id,
        creatorId: alex.id,
        assigneeId: elena.id,
      },
    ],
  });

  console.log('Sample tasks created.');
  console.log('Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
