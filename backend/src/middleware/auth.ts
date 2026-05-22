import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
  projectMember?: {
    projectId: string;
    role: string;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'ethara_ai_secret_key_2026_super_secure';

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    const userDecoded = decoded as { userId: string; email: string };
    
    try {
      // Validate that the user still exists in the database (e.g. database wasn't cleared)
      const user = await prisma.user.findUnique({
        where: { id: userDecoded.userId },
        select: { id: true, email: true },
      });

      if (!user) {
        return res.status(401).json({ error: 'Session is invalid or user no longer exists. Please sign out and sign up again.' });
      }

      req.user = { userId: user.id, email: user.email };
      next();
    } catch (error) {
      console.error('Database verification error in authenticateToken:', error);
      return res.status(500).json({ error: 'Authentication internal error' });
    }
  });
};

export const requireProjectRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'User is not authenticated' });
      }

      let projectId = req.params.projectId || req.body.projectId || (req.query.projectId as string);

      // Fallback: parse from URL path /projects/:projectId
      if (!projectId) {
        const match = req.originalUrl.match(/\/projects\/([^\/?#]+)/i);
        if (match) {
          projectId = match[1];
        }
      }

      // Fallback: project routing endpoint contains /projects/ and params.id
      if (!projectId && req.params.id && req.originalUrl.toLowerCase().includes('/projects/')) {
        projectId = req.params.id;
      }

      // If it's a task routing endpoint: contains /tasks/
      if (!projectId && req.params.id && req.originalUrl.toLowerCase().includes('/tasks/')) {
        const task = await prisma.task.findUnique({
          where: { id: req.params.id },
          select: { projectId: true },
        });
        if (task) {
          projectId = task.projectId;
        }
      }

      if (!projectId) {
        return res.status(400).json({ error: 'Project ID could not be identified' });
      }

      // Query project membership
      const member = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },
      });

      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this project' });
      }

      if (!allowedRoles.includes(member.role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient project permissions' });
      }

      req.projectMember = {
        projectId,
        role: member.role,
      };
      next();
    } catch (error) {
      console.error('Error in requireProjectRole middleware:', error);
      return res.status(500).json({ error: 'Authorization middleware error' });
    }
  };
};

