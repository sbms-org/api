import { Router } from 'express';
import { FileController } from '../controllers/file.controller';
import { authMiddleware } from '../middlewares/auth';

const router: Router = Router();
const fileController = new FileController();

// Secure file access
router.get('{/*path}', authMiddleware, fileController.serveFile);

export default router;
