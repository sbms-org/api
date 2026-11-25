import app from './app';
import logger from './configurations/logger';
import { dataSource } from './configurations/db.config';

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, '0.0.0.0', () => {
  logger.info(`Server (PID ${process.pid}) is running on port ${port}`);
});

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} signal received. Shutting down gracefully...`);

  server.close(async () => {
    logger.info('Server closed.');
    try {
      if (dataSource.isInitialized) {
        await dataSource.destroy();
        logger.info('Database connection closed.');
      }
    } catch (err) {
      logger.error('Error during database teardown', err);
    }
    process.exit(0);
  });

  // If server hasn't closed in 10s, force shutdown
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  // In production, we might want to shut down gracefully
  // gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});
