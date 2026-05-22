import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import prisma from './db';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', projectRoutes);
app.use('/api', taskRoutes);

const PORT = 5002;
const BASE_URL = `http://localhost:${PORT}/api`;

let server: any;

async function setup() {
  server = app.listen(PORT, () => {
    console.log(`Test server running on ${BASE_URL}`);
  });

  // Purge DB to start fresh
  await prisma.task.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Database tables cleared for test run.');
}

async function runTests() {
  console.log('\n--- STARTING INTEGRATION TESTS ---\n');

  let adminToken = '';
  let adminId = '';
  let memberToken = '';
  let memberId = '';
  let projectId = '';
  let taskId = '';

  // 1. SIGNUP ADMIN (User A)
  console.log('Test 1: Admin Signup...');
  const resSignupA = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123', name: 'Admin User' }),
  });
  const dataSignupA = await resSignupA.json() as any;
  if (resSignupA.status !== 201 || !dataSignupA.token) {
    throw new Error(`Admin signup failed: ${JSON.stringify(dataSignupA)}`);
  }
  adminToken = dataSignupA.token;
  adminId = dataSignupA.user.id;
  console.log('✔ Admin Signup successful.');

  // 2. SIGNUP MEMBER (User B)
  console.log('Test 2: Member Signup...');
  const resSignupB = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'member@test.com', password: 'password123', name: 'Member User' }),
  });
  const dataSignupB = await resSignupB.json() as any;
  if (resSignupB.status !== 201 || !dataSignupB.token) {
    throw new Error(`Member signup failed: ${JSON.stringify(dataSignupB)}`);
  }
  memberToken = dataSignupB.token;
  memberId = dataSignupB.user.id;
  console.log('✔ Member Signup successful.');

  // 3. LOGIN ADMIN
  console.log('Test 3: Admin Login...');
  const resLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@test.com', password: 'password123' }),
  });
  const dataLogin = await resLogin.json() as any;
  if (resLogin.status !== 200 || !dataLogin.token) {
    throw new Error(`Login failed: ${JSON.stringify(dataLogin)}`);
  }
  console.log('✔ Admin Login successful.');

  // 4. CREATE PROJECT (User A)
  console.log('Test 4: Create Project...');
  const resProj = await fetch(`${BASE_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: 'Alpha Project', description: 'Our primary roadmap' }),
  });
  const dataProj = await resProj.json() as any;
  if (resProj.status !== 201 || !dataProj.id) {
    throw new Error(`Create project failed: ${JSON.stringify(dataProj)}`);
  }
  projectId = dataProj.id;
  console.log('✔ Project created successfully.');

  // 5. SEARCH USERS (User A searches for User B)
  console.log('Test 5: Search Users...');
  const resSearch = await fetch(`${BASE_URL}/users/search?query=member`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  const dataSearch = await resSearch.json() as any;
  if (resSearch.status !== 200 || dataSearch.length === 0 || dataSearch[0].email !== 'member@test.com') {
    throw new Error(`Search users failed: ${JSON.stringify(dataSearch)}`);
  }
  console.log('✔ User search returned valid results.');

  // 6. ADD USER B TO PROJECT AS MEMBER
  console.log('Test 6: Add User B as Member...');
  const resAddMember = await fetch(`${BASE_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ email: 'member@test.com', role: 'MEMBER' }),
  });
  const dataAddMember = await resAddMember.json() as any;
  if (resAddMember.status !== 201 || dataAddMember.role !== 'MEMBER') {
    throw new Error(`Add member failed: ${JSON.stringify(dataAddMember)}`);
  }
  console.log('✔ User B successfully added to project.');

  // 7. BLOCK MEMBER FROM ADDING NEW MEMBERS
  console.log('Test 7: Verify Member cannot add new members...');
  const resMemberAddFail = await fetch(`${BASE_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ email: 'external@test.com', role: 'MEMBER' }),
  });
  if (resMemberAddFail.status !== 403) {
    throw new Error(`Member bypass RBAC: Added member successfully (status ${resMemberAddFail.status})`);
  }
  console.log('✔ RBAC enforced: Member blocked from adding users.');

  // 8. CREATE TASK (User A)
  console.log('Test 8: Admin Create Task...');
  const resTask = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Design Database Schema',
      description: 'Setup initial PostgreSQL tables',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), // 3 days from now
      assigneeId: memberId,
    }),
  });
  const dataTask = await resTask.json() as any;
  if (resTask.status !== 201 || !dataTask.id) {
    throw new Error(`Task creation failed: ${JSON.stringify(dataTask)}`);
  }
  taskId = dataTask.id;
  console.log('✔ Task successfully created and assigned to User B.');

  // 9. MEMBER CREATE TASK (Should Fail)
  console.log('Test 9: Verify Member cannot create tasks...');
  const resMemberTaskFail = await fetch(`${BASE_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({
      title: 'Member Rogue Task',
      dueDate: new Date().toISOString(),
    }),
  });
  if (resMemberTaskFail.status !== 403) {
    throw new Error(`Member bypass RBAC: Created task successfully (status ${resMemberTaskFail.status})`);
  }
  console.log('✔ RBAC enforced: Member blocked from creating tasks.');

  // 10. MEMBER UPDATE TASK STATUS (Should Succeed)
  console.log('Test 10: Member updates status...');
  const resMemberStatus = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });
  const dataMemberStatus = await resMemberStatus.json() as any;
  if (resMemberStatus.status !== 200 || dataMemberStatus.status !== 'IN_PROGRESS') {
    throw new Error(`Member status update failed: ${JSON.stringify(dataMemberStatus)}`);
  }
  console.log('✔ Member successfully updated status.');

  // 11. MEMBER UPDATE ADMIN FIELDS (Should Fail)
  console.log('Test 11: Verify Member cannot update administrative fields...');
  const resMemberFieldFail = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`,
    },
    body: JSON.stringify({ title: 'Hacked Title', status: 'DONE' }),
  });
  if (resMemberFieldFail.status !== 403) {
    throw new Error(`Member bypass RBAC: Modified admin task fields (status ${resMemberFieldFail.status})`);
  }
  console.log('✔ RBAC enforced: Member blocked from editing task fields (title).');

  // 12. ADMIN EDIT ALL FIELDS
  console.log('Test 12: Admin edits task fields...');
  const resAdminEdit = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ title: 'Refactored DB Schema', priority: 'LOW' }),
  });
  const dataAdminEdit = await resAdminEdit.json() as any;
  if (resAdminEdit.status !== 200 || dataAdminEdit.title !== 'Refactored DB Schema' || dataAdminEdit.priority !== 'LOW') {
    throw new Error(`Admin edit task failed: ${JSON.stringify(dataAdminEdit)}`);
  }
  console.log('✔ Admin successfully edited title and priority.');

  // 13. MEMBER DELETE TASK (Should Fail)
  console.log('Test 13: Verify Member cannot delete tasks...');
  const resMemberDeleteFail = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${memberToken}` },
  });
  if (resMemberDeleteFail.status !== 403) {
    throw new Error(`Member bypass RBAC: Deleted task (status ${resMemberDeleteFail.status})`);
  }
  console.log('✔ RBAC enforced: Member blocked from deleting tasks.');

  // 14. ADMIN DELETE TASK (Should Succeed)
  console.log('Test 14: Admin deletes task...');
  const resAdminDelete = await fetch(`${BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  if (resAdminDelete.status !== 200) {
    throw new Error(`Admin failed to delete task: ${resAdminDelete.status}`);
  }
  console.log('✔ Admin successfully deleted task.');

  console.log('\n✔✔✔ ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✔✔✔\n');
}

async function shutdown() {
  if (server) {
    await server.close();
    console.log('Test server shut down.');
  }
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
    process.exitCode = 1;
  } finally {
    await shutdown();
    process.exit();
  }
}

main();
