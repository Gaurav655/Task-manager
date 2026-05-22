import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireProjectRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// SEARCH USERS (for team invitation)
router.get('/users/search', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.query as string;
    const currentUserId = req.user?.userId;

    if (!query) {
      return res.status(200).json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { email: { contains: query } },
              { name: { contains: query } }
            ]
          },
          { id: { not: currentUserId } } // Don't search for self
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 8
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Search users error:', error);
    return res.status(500).json({ error: 'Failed to search users' });
  }
});

// CREATE PROJECT
router.post('/projects', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description } = req.body;
    const userId = req.user?.userId;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Use Prisma transaction to create project and add creator as ADMIN
    const project = await prisma.$transaction(async (tx) => {
      const proj = await tx.project.create({
        data: {
          name,
          description,
        },
      });

      await tx.projectMember.create({
        data: {
          projectId: proj.id,
          userId: userId,
          role: 'ADMIN',
        },
      });

      return proj;
    });

    return res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

// GET ALL PROJECTS THE USER BELONGS TO
router.get('/projects', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find all projects where the user is a member
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      include: {
        project: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                }
              }
            },
            _count: {
              select: { tasks: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format output
    const projects = memberships.map((membership) => ({
      ...membership.project,
      userRole: membership.role, // "ADMIN" or "MEMBER"
      tasksCount: membership.project._count.tasks,
      members: membership.project.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
    }));

    return res.status(200).json(projects);
  } catch (error) {
    console.error('Fetch projects error:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// GET PROJECT BY ID
router.get('/projects/:id', authenticateToken, requireProjectRole(['ADMIN', 'MEMBER']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const userId = req.user?.userId;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, name: true, email: true }
            },
            creator: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: {
            dueDate: 'asc'
          }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Find calling user's role in this project
    const currentMember = project.members.find((m) => m.userId === userId);

    const formattedProject = {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      userRole: currentMember?.role || 'MEMBER',
      members: project.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      tasks: project.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        projectId: t.projectId,
        creator: t.creator,
        assignee: t.assignee,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };

    return res.status(200).json(formattedProject);
  } catch (error) {
    console.error('Fetch project details error:', error);
    return res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// ADD MEMBER TO PROJECT
router.post('/projects/:id/members', authenticateToken, requireProjectRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const { email, role } = req.body; // invite by email, role defaults to "MEMBER"

    if (!email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';

    // Find the user to add
    const userToAdd = await prisma.user.findUnique({
      where: { email },
    });

    if (!userToAdd) {
      return res.status(404).json({ error: 'User with this email does not exist' });
    }

    // Check if user is already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: userToAdd.id,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }

    // Add user to project
    const newMember = await prisma.projectMember.create({
      data: {
        projectId,
        userId: userToAdd.id,
        role: assignedRole,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(201).json({
      id: newMember.user.id,
      name: newMember.user.name,
      email: newMember.user.email,
      role: newMember.role,
    });
  } catch (error) {
    console.error('Add project member error:', error);
    return res.status(500).json({ error: 'Failed to add project member' });
  }
});

// REMOVE MEMBER FROM PROJECT
router.delete('/projects/:id/members/:userId', authenticateToken, requireProjectRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const projectId = req.params.id;
    const targetUserId = req.params.userId;

    // Check if member exists
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found in this project' });
    }

    // Avoid removing the last admin
    if (member.role === 'ADMIN') {
      const adminCount = await prisma.projectMember.count({
        where: {
          projectId,
          role: 'ADMIN',
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the only administrator of the project' });
      }
    }

    // Delete membership
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: targetUserId,
        },
      },
    });

    return res.status(200).json({ message: 'Member successfully removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    return res.status(500).json({ error: 'Failed to remove member' });
  }
});

export default router;
