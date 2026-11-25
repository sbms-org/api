import { NextFunction, Request, Response } from 'express'
import { UserRoleType } from '../Entities/user'

export const roleMiddleware = (allowedRoles: UserRoleType[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Access denied' })
    }
    return next()
  }
