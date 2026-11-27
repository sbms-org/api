import 'dotenv/config'; // Import and configure dotenv
import express, { Application } from 'express';
// import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { swaggerDocument } from './swagger';
import { dataSource } from './configurations/db.config';
import logger from './configurations/logger';
import { correlationIdHandler } from './middlewares/correlation-id.handler';
import { devSecretHandler } from './middlewares/dev-secret.handler';
import { typeCleanupHandler } from './middlewares/type-cleanup.handler';
import { errorHandler } from './middlewares/error-handler';
import * as Routes from './routers';
import DemoRouter from './routers/demo.routes';
import { isDemoDataActive } from './services/sbms-demo-store';

class App {
  public express: Application = express();

  constructor() {
    this.init();
  }

  private async init() {
    this.setPreMiddleware();
    this.mountRoutes();
    this.setPostMiddleware();
    await this.initDatabase();
  }

  private setPreMiddleware(): void {
    this.express.use(correlationIdHandler);
    this.express.use(devSecretHandler);

    // Security Middlewares
    // this.express.use(helmet());
    this.express.use(cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      exposedHeaders: ['X-SBMS-Data-Source'],
    }));

    // Rate Limiting (Relaxed if dev secret present)
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      skip: (req) => (req as any).isDevTesting,
      message: 'Too many requests from this IP, please try again after 15 minutes',
    });
    this.express.use(limiter);

    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: false }));
    this.express.use(typeCleanupHandler);
    this.express.use(express.static('uploads'));

    // Logging
    this.express.use(
      morgan(
        ':remote-addr :remote-user :method :url HTTP/:http-version :status :res[content-length] - :response-time ms',
        {
          stream: {
            write: (message: string) => logger.info(message.trim()),
          },
        }
      )
    );

    // Swagger
    this.express.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }

  private mountRoutes(): void {
    this.express.get('/', (req, res) => {
      res.status(200).json({ success: true, message: 'API is running' });
    });

    this.express.get('/health', async (req, res) => {
      const isConnected = dataSource.isInitialized;
      const demoMode = await isDemoDataActive();
      res.status(isConnected || demoMode ? 200 : 503).json({
        success: isConnected || demoMode,
        message: isConnected ? 'Database Connected' : demoMode ? 'Using SBMS JSON demo data' : 'Database Disconnected',
        databaseConnected: isConnected,
        demoMode,
      });
    });

    this.express.use(`${process.env.API_BASE}/`, DemoRouter);
    this.express.use(`${process.env.API_BASE}/auth`, Routes.AuthRouter);
    this.express.use(`${process.env.API_BASE}/admin`, Routes.AdminRouter);
    this.express.use(`${process.env.API_BASE}/files`, Routes.FileRouter);
    this.express.use(`${process.env.API_BASE}/notification-preferences`, Routes.NotificationPreferencesRouter);
    this.express.use(`${process.env.API_BASE}/user`, Routes.UserProfileRouter);
    this.express.use(`${process.env.API_BASE}/`, Routes.SbmsRouter);

    // Handle 404
    this.express.use((req, res) => {
      res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} Not Found`,
      });
    });
  }

  private setPostMiddleware(): void {
    this.express.use(errorHandler);
  }

  private async initDatabase(): Promise<void> {
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
        logger.info('Data Source has been initialized');
      }
    } catch (error) {
      logger.error('Error during Data Source initialization', error);
      // Don't crash here, might retry or let health check handle it
    }
  }
}

export default new App().express;
