import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { UserAuthService } from './services/user-auth.service';
import { SessionService } from './services/session.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { GitHubUserOAuthService } from './services/github-user-oauth.service';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthGuard } from './guards/auth.guard';
import {
  SignupDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

@ApiTags('User Authentication')
@Controller('user-auth')
@UseGuards(AuthGuard)
export class UserAuthController {
  private readonly logger = new Logger(UserAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly userAuthService: UserAuthService,
    private readonly sessionService: SessionService,
    private readonly googleOAuth: GoogleOAuthService,
    private readonly githubOAuth: GitHubUserOAuthService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  }

  // ============ Email/Password ============

  @Post('signup')
  @Public()
  @ApiOperation({ summary: 'Register new user with email/password' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or weak password' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { user, sessionToken, expiresAt } = await this.userAuthService.signup(
      dto,
      req.headers['user-agent'],
      req.ip,
    );
    this.setSessionCookie(res, sessionToken, expiresAt);
    return res.status(HttpStatus.CREATED).json({ user: this.sanitizeUser(user) });
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { user, sessionToken, expiresAt } = await this.userAuthService.login(
      dto,
      req.headers['user-agent'],
      req.ip,
    );
    this.setSessionCookie(res, sessionToken, expiresAt);
    return res.json({ user: this.sanitizeUser(user) });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Req() req: Request, @Res() res: Response) {
    const sessionToken = req.cookies?.['devflow_session'];
    if (sessionToken) {
      await this.sessionService.destroySession(sessionToken);
    }
    res.clearCookie('devflow_session');
    return res.json({ message: 'Logged out successfully' });
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user data' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async me(@CurrentUser() user: User) {
    return this.sanitizeUser(user);
  }

  // ============ Email Verification ============

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.userAuthService.verifyEmail(dto.token);
    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Email already verified' })
  async resendVerification(@CurrentUser() user: User) {
    await this.userAuthService.resendVerificationEmail(user.id);
    return { message: 'Verification email sent' };
  }

  // ============ Password Reset ============

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'If account exists, reset email sent' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.userAuthService.sendPasswordResetEmail(dto.email);
    // Always return success to prevent email enumeration
    return { message: 'If an account exists with this email, a reset link has been sent' };
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.userAuthService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  // ============ OAuth Google ============

  @Get('google')
  @Public()
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth' })
  @ApiResponse({ status: 501, description: 'Google OAuth not configured' })
  async googleAuth(@Res() res: Response) {
    if (!this.googleOAuth.isConfigured()) {
      return res.status(HttpStatus.NOT_IMPLEMENTED).json({
        message: 'Google OAuth not configured',
      });
    }

    const authUrl = this.googleOAuth.getAuthorizationUrl();
    return res.redirect(authUrl);
  }

  @Get('google/callback')
  @Public()
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`Google OAuth error: ${error}`);
      return res.redirect(`${this.frontendUrl}/login?error=google_auth_failed`);
    }

    if (!code) {
      return res.redirect(`${this.frontendUrl}/login?error=no_code`);
    }

    try {
      const googleUser = await this.googleOAuth.authenticate(code);
      const user = await this.userAuthService.findOrCreateSSOUser(
        'google',
        googleUser.ssoId,
        googleUser.email,
        googleUser.name,
        googleUser.avatar,
      );

      const { sessionToken, expiresAt } = await this.userAuthService.createSSOSession(
        user,
        req.headers['user-agent'],
        req.ip,
      );

      this.setSessionCookie(res, sessionToken, expiresAt);
      return res.redirect(`${this.frontendUrl}/dashboard`);
    } catch (err) {
      this.logger.error(`Google OAuth callback error: ${err}`);
      return res.redirect(`${this.frontendUrl}/login?error=google_auth_failed`);
    }
  }

  // ============ OAuth GitHub ============

  @Get('github')
  @Public()
  @ApiOperation({ summary: 'Initiate GitHub OAuth for user login' })
  @ApiResponse({ status: 302, description: 'Redirects to GitHub OAuth' })
  @ApiResponse({ status: 501, description: 'GitHub OAuth not configured' })
  async githubAuth(@Res() res: Response) {
    if (!this.githubOAuth.isConfigured()) {
      return res.status(HttpStatus.NOT_IMPLEMENTED).json({
        message: 'GitHub OAuth not configured',
      });
    }

    const authUrl = this.githubOAuth.getAuthorizationUrl();
    return res.redirect(authUrl);
  }

  @Get('github/callback')
  @Public()
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  async githubCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`GitHub OAuth error: ${error}`);
      return res.redirect(`${this.frontendUrl}/login?error=github_auth_failed`);
    }

    if (!code) {
      return res.redirect(`${this.frontendUrl}/login?error=no_code`);
    }

    try {
      const githubUser = await this.githubOAuth.authenticate(code);
      const user = await this.userAuthService.findOrCreateSSOUser(
        'github',
        githubUser.ssoId,
        githubUser.email,
        githubUser.name,
        githubUser.avatar,
      );

      const { sessionToken, expiresAt } = await this.userAuthService.createSSOSession(
        user,
        req.headers['user-agent'],
        req.ip,
      );

      this.setSessionCookie(res, sessionToken, expiresAt);
      return res.redirect(`${this.frontendUrl}/dashboard`);
    } catch (err) {
      this.logger.error(`GitHub OAuth callback error: ${err}`);
      return res.redirect(`${this.frontendUrl}/login?error=github_auth_failed`);
    }
  }

  // ============ Helpers ============

  private setSessionCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie('devflow_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });
  }

  private sanitizeUser(user: User) {
    // Remove sensitive fields
    const { passwordHash, ...safeUser } = user as User & { passwordHash?: string };
    return safeUser;
  }
}
