// requires further research
import { Request, Response, NextFunction } from 'express';
import jwt from 'jwt-simple';
import { dataSource } from '../configurations/db.config';
import { User } from '../Entities/user';
import logger from '../configurations/logger';
import { demoUserById, isDemoDataActive, markDemoResponse } from '../services/sbms-demo-store';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    logger.error('auth middleware blocked this method, no auth header token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.decode(token, process.env.JWT_SECRET as string);
    if (payload.demo === true &&
        await isDemoDataActive(req.get('X-SBMS-Data-Mode') === 'database')) {
      const demoUser = demoUserById(payload.user)
      if (!demoUser || demoUser.status !== 'ACTIVE') {
        return res.status(401).json({ error: 'Demo user not found or inactive' });
      }
      markDemoResponse(res)
      ;(req as any).user = {
        ...demoUser,
        name: demoUser.fullname,
      }
      return next()
    }
    const user = await dataSource.getRepository(User).findOneBy({ id: payload.user });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    (req as any).user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
