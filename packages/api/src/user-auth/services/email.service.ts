import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('SMTP_FROM', 'noreply@devflow.local');
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');

    if (host && port) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: this.configService.get<string>('SMTP_SECURE') === 'true',
        // Auth is optional for development (Mailpit)
        ...(this.configService.get<string>('SMTP_USER') && {
          auth: {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASS'),
          },
        }),
      });

      this.logger.log(`Email service configured with SMTP host: ${host}:${port}`);
    } else {
      this.logger.warn('SMTP not configured - emails will be logged to console');
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[Email - Console Mode]`);
      this.logger.log(`To: ${options.to}`);
      this.logger.log(`Subject: ${options.subject}`);
      this.logger.log(`Body: ${options.text}`);
      return;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      throw error;
    }
  }

  // ============ Email Verification ============

  async sendVerificationEmail(email: string, token: string, userName?: string): Promise<void> {
    const verifyUrl = `${this.frontendUrl}/verify-email/${token}`;
    const name = userName || 'there';

    await this.sendEmail({
      to: email,
      subject: 'Verify your DevFlow account',
      text: `
Hi ${name},

Welcome to DevFlow! Please verify your email address by clicking the link below:

${verifyUrl}

This link will expire in 24 hours.

If you didn't create a DevFlow account, you can safely ignore this email.

Thanks,
The DevFlow Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin: 0;">DevFlow</h1>
  </div>

  <h2 style="color: #1f2937;">Hi ${name},</h2>

  <p>Welcome to DevFlow! Please verify your email address by clicking the button below:</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${verifyUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Verify Email Address
    </a>
  </div>

  <p style="color: #6b7280; font-size: 14px;">
    Or copy and paste this link into your browser:<br>
    <a href="${verifyUrl}" style="color: #2563eb; word-break: break-all;">${verifyUrl}</a>
  </p>

  <p style="color: #6b7280; font-size: 14px;">
    This link will expire in 24 hours.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    If you didn't create a DevFlow account, you can safely ignore this email.
  </p>
</body>
</html>
      `.trim(),
    });
  }

  // ============ Password Reset ============

  async sendPasswordResetEmail(email: string, token: string, userName?: string): Promise<void> {
    const resetUrl = `${this.frontendUrl}/reset-password/${token}`;
    const name = userName || 'there';

    await this.sendEmail({
      to: email,
      subject: 'Reset your DevFlow password',
      text: `
Hi ${name},

We received a request to reset your DevFlow password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.

Thanks,
The DevFlow Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin: 0;">DevFlow</h1>
  </div>

  <h2 style="color: #1f2937;">Hi ${name},</h2>

  <p>We received a request to reset your DevFlow password. Click the button below to create a new password:</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetUrl}" style="background-color: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Reset Password
    </a>
  </div>

  <p style="color: #6b7280; font-size: 14px;">
    Or copy and paste this link into your browser:<br>
    <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
  </p>

  <p style="color: #6b7280; font-size: 14px;">
    This link will expire in 1 hour.
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
  </p>
</body>
</html>
      `.trim(),
    });
  }

  // ============ Welcome Email (after verification) ============

  async sendWelcomeEmail(email: string, userName?: string): Promise<void> {
    const dashboardUrl = `${this.frontendUrl}/dashboard`;
    const name = userName || 'there';

    await this.sendEmail({
      to: email,
      subject: 'Welcome to DevFlow!',
      text: `
Hi ${name},

Your email has been verified and your DevFlow account is now active!

Get started by visiting your dashboard: ${dashboardUrl}

With DevFlow, you can:
- Automatically transform Linear tickets into working code
- Generate technical specifications using AI
- Create pull requests with tests
- And much more!

If you have any questions, don't hesitate to reach out.

Thanks,
The DevFlow Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to DevFlow</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #2563eb; margin: 0;">DevFlow</h1>
  </div>

  <h2 style="color: #1f2937;">Welcome, ${name}!</h2>

  <p>Your email has been verified and your DevFlow account is now active!</p>

  <div style="text-align: center; margin: 30px 0;">
    <a href="${dashboardUrl}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
      Go to Dashboard
    </a>
  </div>

  <h3 style="color: #1f2937; margin-top: 30px;">What you can do with DevFlow:</h3>
  <ul style="color: #4b5563;">
    <li>Automatically transform Linear tickets into working code</li>
    <li>Generate technical specifications using AI</li>
    <li>Create pull requests with tests</li>
    <li>Orchestrate your entire development workflow</li>
  </ul>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

  <p style="color: #9ca3af; font-size: 12px;">
    If you have any questions, don't hesitate to reach out.
  </p>
</body>
</html>
      `.trim(),
    });
  }
}
