// requires further research
import { Request, Response, NextFunction } from 'express';
import jwt from 'jwt-simple';
import { dataSource } from '../configurations/db.config';
import { User } from '../Entities/user';
import logger from '../configurations/logger';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    logger.error('auth middleware blocked this method, no auth header token provided');
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.decode(token, process.env.JWT_SECRET as string);
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
