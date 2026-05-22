import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, requireProjectRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// CREATE TASK
// Endpoint: POST /api/projects/:projectId/tasks
router.post('/projects/:projectId/tasks', authenticateToken, requireProjectRole(['ADMIN']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { title, description, priority, dueDate, assigneeId } = req.body;
    const creatorId = req.user?.userId;

    if (!creatorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    // Verify priority is low, medium or high
    const taskPriority = ['LOW', 'MEDIUM', 'HIGH'].includes(priority) ? priority : 'MEDIUM';

    // Verify dueDate is valid
    if (!dueDate) {
      return res.status(400).json({ error: 'Due date is required' });
    }
    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ error: 'Invalid due date format' });
    }

    // Verify assignee is a member of the project if assigneeId is provided
    if (assigneeId) {
      const isMember = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: assigneeId,
          },
        },
      });

      if (!isMember) {
        return res.status(400).json({ error: 'Assignee must be a member of this project' });
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: 'TODO',
        priority: taskPriority,
        dueDate: parsedDueDate,
        projectId,
        creatorId,
        assigneeId: assigneeId || null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

// UPDATE TASK
// Endpoint: PUT /api/tasks/:id
// Because it's `/tasks/:id`, we dynamically verify the project role inside the route handler
router.put('/tasks/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the task
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Find user's role in this task's project
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId,
        },
      },
    });

    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project' });
    }

    const { title, description, priority, dueDate, assigneeId, status } = req.body;

    // Enforce role-based update rules
    if (member.role === 'MEMBER') {
      // Members can ONLY update status
      if (
        title !== undefined ||
        description !== undefined ||
        priority !== undefined ||
        dueDate !== undefined ||
        assigneeId !== undefined
      ) {
        return res.status(403).json({
          error: 'Forbidden: Project Members can only update task status. Administrative fields require Project Admin access.',
        });
      }

      if (status === undefined) {
        return res.status(400).json({ error: 'Status is required for update' });
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (status !== undefined) {
      const allowedStatus = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed values: ${allowedStatus.join(', ')}` });
      }
      updateData.status = status;
    }

    // If Admin, they can update other fields
    if (member.role === 'ADMIN') {
      if (title !== undefined) {
        if (!title.trim()) return res.status(400).json({ error: 'Task title cannot be empty' });
        updateData.title = title;
      }
      if (description !== undefined) updateData.description = description;
      if (priority !== undefined) {
        if (!['LOW', 'MEDIUM', 'HIGH'].includes(priority)) {
          return res.status(400).json({ error: 'Invalid priority level' });
        }
        updateData.priority = priority;
      }
      if (dueDate !== undefined) {
        const parsedDueDate = new Date(dueDate);
        if (isNaN(parsedDueDate.getTime())) {
          return res.status(400).json({ error: 'Invalid due date format' });
        }
        updateData.dueDate = parsedDueDate;
      }
      if (assigneeId !== undefined) {
        if (assigneeId !== null) {
          // Verify assignee is part of project
          const isMember = await prisma.projectMember.findUnique({
            where: {
              projectId_userId: {
                projectId: task.projectId,
                userId: assigneeId,
              },
            },
          });
          if (!isMember) {
            return res.status(400).json({ error: 'Assignee must be a member of this project' });
          }
          updateData.assigneeId = assigneeId;
        } else {
          updateData.assigneeId = null;
        }
      }
    }

    // Update database
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        assignee: {
          select: { id: true, name: true, email: true }
        },
        creator: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return res.status(200).json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE TASK
// Endpoint: DELETE /api/tasks/:id
router.delete('/tasks/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const taskId = req.params.id;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify user is an ADMIN of the task's project
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId,
        },
      },
    });

    if (!member || member.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only Project Admins can delete tasks' });
    }

    await prisma.task.delete({
      where: { id: taskId },
    });

    return res.status(200).json({ message: 'Task successfully deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
