import nodemailer from 'nodemailer';
import logger from '../configurations/logger';

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;
  private initialized: boolean = false;

  private constructor() {
    this.initializeTransporter();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initializeTransporter(): void {
    try {
      const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        logger.warn('Email service not configured. Email notifications will be disabled.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT || '587'),
        secure: SMTP_PORT === '465',
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      this.initialized = true;
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.initialized || !this.transporter) {
      logger.warn('Email service not initialized. Skipping email.');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@pms.com',
        to,
        subject,
        html,
      });
      logger.info(`Email sent to ${to}: ${subject}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendNotificationEmail(
    to: string,
    title: string,
    message: string,
    actionUrl?: string,
    actionText?: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; padding: 12px 24px; background: #4CAF50; color: white; text-decoration: none; border-radius: 4px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${title}</h2>
          </div>
          <div class="content">
            <p>${message}</p>
            ${actionUrl && actionText ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ''}
          </div>
          <div class="footer">
            <p>This is an automated notification from Property Management System.</p>
            <p>To manage your notification preferences, log in to your account.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, title, html);
  }
}

export const emailService = EmailService.getInstance();
