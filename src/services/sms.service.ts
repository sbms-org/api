import * as nodemailer from 'nodemailer';

export class SmsService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      port: Number(process.env.SMS_PROVIDER_PORT),
      host: process.env.SMS_PROVIDER_HOST,
      secure: false,
      auth: {
        user: process.env.SMS_PROVIDER_USERNAME,
        pass: process.env.SMS_PROVIDER_PASSWORD,
      },
    });
  }

  async sendOtp(to: string, subject: string, text: string) {
    const info = await this.transporter.sendMail({
      from: process.env.SMS_TEXT_FROM,
      to,
      subject,
      text,
    });
    console.log('Message sent: %s', info.messageId);
  }
}

export const Sms: SmsService = new SmsService();
