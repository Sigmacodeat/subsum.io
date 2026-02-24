import { resolveMx, resolveTxt, setServers } from 'node:dns/promises';

import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpStatus,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import {
  ActionForbidden,
  Config,
  CryptoHelper,
  EmailTokenNotFound,
  InvalidAuthState,
  InvalidEmail,
  InvalidEmailToken,
  SignUpForbidden,
  Throttle,
  SessionCache,
  URLHelper,
  UseNamedGuard,
  WrongSignInCredentials,
} from '../../base';
import { Models, TokenType } from '../../models';
import { FeatureService } from '../features';
import { validators } from '../utils/validators';
import { Public } from './guard';
import { AuthService } from './service';
import { CurrentUser, Session } from './session';

interface PreflightResponse {
  registered: boolean;
  hasPassword: boolean;
}

interface SignInCredential {
  email: string;
  password?: string;
  callbackUrl?: string;
  client_nonce?: string;
  admin_step_up?: boolean;
}

interface MagicLinkCredential {
  email: string;
  token: string;
  client_nonce?: string;
}

interface OpenAppSignInCredential {
  code: string;
}

interface AdminMfaVerifyCredential {
  ticket: string;
  otp: string;
}

interface AdminMfaResendCredential {
  ticket: string;
}

interface AdminMfaChallengeRecord {
  userId: string;
  email: string;
  otpHash: string;
  attempts: number;
  riskLevel: 'low' | 'elevated';
  fingerprintHash: string;
}

const ADMIN_MFA_CHALLENGE_PREFIX = 'ADMIN_MFA_CHALLENGE';
const ADMIN_STEP_UP_PREFIX = 'ADMIN_STEP_UP_SESSION';
const ADMIN_TRUSTED_DEVICE_PREFIX = 'ADMIN_TRUSTED_DEVICE';
const MAX_ADMIN_MFA_ATTEMPTS = 5;

@Throttle('strict')
@Controller('/api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly url: URLHelper,
    private readonly auth: AuthService,
    private readonly models: Models,
    private readonly config: Config,
    private readonly crypto: CryptoHelper,
    private readonly feature: FeatureService,
    private readonly sessionCache: SessionCache
  ) {
    if (env.dev) {
      // set DNS servers in dev mode
      // NOTE: some network debugging software uses DNS hijacking
      // to better debug traffic, but their DNS servers may not
      // handle the non dns query(like txt, mx) correctly, so we
      // set a public DNS server here to avoid this issue.
      setServers(['1.1.1.1', '8.8.8.8']);
    }
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/preflight')
  async preflight(
    @Body() params?: { email: string }
  ): Promise<PreflightResponse> {
    if (!params?.email) {
      throw new InvalidEmail({ email: 'not provided' });
    }
    validators.assertValidEmail(params.email);

    const user = await this.models.user.getUserByEmail(params.email);

    if (!user) {
      return {
        registered: false,
        hasPassword: false,
      };
    }

    return {
      registered: user.registered,
      hasPassword: !!user.password,
    };
  }

  @Public()
  @UseNamedGuard('version', 'captcha')
  @Post('/sign-in')
  @Header('content-type', 'application/json')
  async signIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body() credential: SignInCredential
  ) {
    validators.assertValidEmail(credential.email);
    const canSignIn = await this.auth.canSignIn(credential.email);
    if (!canSignIn) {
      throw new ActionForbidden();
    }

    if (credential.password) {
      await this.passwordSignIn(
        req,
        res,
        credential.email,
        credential.password,
        credential.admin_step_up === true
      );
    } else {
      await this.sendMagicLink(
        res,
        credential.email,
        credential.callbackUrl,
        credential.client_nonce
      );
    }
  }

  async passwordSignIn(
    req: Request,
    res: Response,
    email: string,
    password: string,
    adminStepUp: boolean = false
  ) {
    const user = await this.auth.signIn(email, password);

    if (adminStepUp && (await this.feature.isAdmin(user.id))) {
      const challenge = await this.createAdminMfaChallenge(req, user.id, email);
      res.status(HttpStatus.ACCEPTED).send({
        mfaRequired: true,
        ticket: challenge.ticket,
        email,
        riskLevel: challenge.riskLevel,
      });
      return;
    }

    await this.auth.setCookies(req, res, user.id);
    res.status(HttpStatus.OK).send(user);
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/admin/verify-mfa')
  async verifyAdminMfa(
    @Req() req: Request,
    @Res() res: Response,
    @Body() credential: AdminMfaVerifyCredential
  ) {
    const { ticket, otp } = credential;
    if (!ticket || !otp) {
      throw new InvalidAuthState();
    }

    const challengeKey = `${ADMIN_MFA_CHALLENGE_PREFIX}:${ticket}`;
    const challenge =
      await this.sessionCache.get<AdminMfaChallengeRecord>(challengeKey);
    if (!challenge) {
      throw new InvalidAuthState();
    }

    const fingerprintHash = this.getRequestFingerprintHash(req);
    if (challenge.fingerprintHash !== fingerprintHash) {
      throw new InvalidAuthState();
    }

    const otpHash = this.crypto.sha256(otp).toString('hex');
    if (!this.crypto.compare(challenge.otpHash, otpHash)) {
      const nextAttempts = challenge.attempts + 1;
      if (nextAttempts >= MAX_ADMIN_MFA_ATTEMPTS) {
        await this.sessionCache.delete(challengeKey);
      } else {
        await this.sessionCache.set(
          challengeKey,
          {
            ...challenge,
            attempts: nextAttempts,
          },
          {
            ttl: this.config.auth.adminSession.mfaChallengeTtl * 1000,
          }
        );
      }
      throw new InvalidAuthState();
    }

    const user = await this.models.user.get(challenge.userId, {
      withDisabled: true,
    });
    if (!user || user.disabled || !(await this.feature.isAdmin(user.id))) {
      await this.sessionCache.delete(challengeKey);
      throw new ActionForbidden();
    }

    const userSession = await this.auth.setCookies(
      req,
      res,
      user.id,
      undefined,
      this.config.auth.adminSession.ttl
    );

    await Promise.all([
      this.sessionCache.delete(challengeKey),
      this.sessionCache.set(
        `${ADMIN_STEP_UP_PREFIX}:${userSession.sessionId}`,
        true,
        {
          ttl: this.config.auth.adminSession.stepUpTtl * 1000,
        }
      ),
      this.sessionCache.mapSet(
        `${ADMIN_TRUSTED_DEVICE_PREFIX}:${user.id}`,
        fingerprintHash,
        {
          seenAt: Date.now(),
        }
      ),
      this.sessionCache.expire(
        `${ADMIN_TRUSTED_DEVICE_PREFIX}:${user.id}`,
        this.config.auth.adminSession.trustedDeviceTtl * 1000
      ),
    ]);

    res.send({
      id: user.id,
      email: user.email,
      mfaVerified: true,
    });
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/admin/resend-mfa')
  async resendAdminMfa(
    @Req() req: Request,
    @Body() credential: AdminMfaResendCredential,
    @Res() res: Response
  ) {
    const { ticket } = credential;
    if (!ticket) {
      throw new InvalidAuthState();
    }

    const challengeKey = `${ADMIN_MFA_CHALLENGE_PREFIX}:${ticket}`;
    const challenge =
      await this.sessionCache.get<AdminMfaChallengeRecord>(challengeKey);
    if (!challenge) {
      throw new InvalidAuthState();
    }

    const fingerprintHash = this.getRequestFingerprintHash(req);
    if (challenge.fingerprintHash !== fingerprintHash) {
      throw new InvalidAuthState();
    }

    await this.reissueAdminMfaChallenge(ticket, challenge);

    res.status(HttpStatus.CREATED).send({
      ticket,
      resent: true,
      riskLevel: challenge.riskLevel,
    });
  }

  @UseNamedGuard('version')
  @Get('/admin/trusted-devices')
  async listAdminTrustedDevices(@CurrentUser() user: CurrentUser) {
    await this.assertAdminUser(user.id);

    const mapKey = `${ADMIN_TRUSTED_DEVICE_PREFIX}:${user.id}`;
    const keys = await this.sessionCache.mapKeys(mapKey);

    const devices = await Promise.all(
      keys.map(async fingerprint => {
        const record = await this.sessionCache.mapGet<{ seenAt: number }>(
          mapKey,
          fingerprint
        );
        return {
          fingerprint,
          seenAt: record?.seenAt ?? 0,
        };
      })
    );

    return {
      devices: devices
        .filter(device => device.seenAt > 0)
        .sort((a, b) => b.seenAt - a.seenAt),
    };
  }

  @UseNamedGuard('version')
  @Delete('/admin/trusted-devices')
  async revokeAdminTrustedDevices(
    @CurrentUser() user: CurrentUser,
    @Query('fingerprint') fingerprint?: string
  ) {
    await this.assertAdminUser(user.id);

    const mapKey = `${ADMIN_TRUSTED_DEVICE_PREFIX}:${user.id}`;

    if (fingerprint) {
      const removed = await this.sessionCache.mapDelete(mapKey, fingerprint);
      return {
        removed: removed ? 1 : 0,
      };
    }

    const cleared = await this.sessionCache.delete(mapKey);
    return {
      removed: cleared ? -1 : 0,
    };
  }

  async sendMagicLink(
    res: Response,
    email: string,
    callbackUrl = '/magic-link',
    clientNonce?: string
  ) {
    if (!this.url.isAllowedCallbackUrl(callbackUrl)) {
      throw new ActionForbidden();
    }

    const callbackUrlObj = this.url.url(callbackUrl);
    const redirectUriInCallback =
      callbackUrlObj.searchParams.get('redirect_uri');
    if (
      redirectUriInCallback &&
      !this.url.isAllowedRedirectUri(redirectUriInCallback)
    ) {
      throw new ActionForbidden();
    }

    // send email magic link
    const user = await this.models.user.getUserByEmail(email, {
      withDisabled: true,
    });

    if (!user) {
      if (!this.config.auth.allowSignup) {
        throw new SignUpForbidden();
      }

      if (this.config.auth.requireEmailDomainVerification) {
        // verify domain has MX, SPF, DMARC records
        const [name, domain, ...rest] = email.split('@');
        if (rest.length || !domain) {
          throw new InvalidEmail({ email });
        }
        const [mx, spf, dmarc] = await Promise.allSettled([
          resolveMx(domain).then(t => t.map(mx => mx.exchange).filter(Boolean)),
          resolveTxt(domain).then(t =>
            t.map(([k]) => k).filter(txt => txt.includes('v=spf1'))
          ),
          resolveTxt('_dmarc.' + domain).then(t =>
            t.map(([k]) => k).filter(txt => txt.includes('v=DMARC1'))
          ),
        ]).then(t => t.filter(t => t.status === 'fulfilled').map(t => t.value));
        if (!mx?.length || !spf?.length || !dmarc?.length) {
          throw new InvalidEmail({ email });
        }
        // filter out alias emails
        if (name.includes('+')) {
          throw new InvalidEmail({ email });
        }
      }
    } else if (user.disabled) {
      throw new WrongSignInCredentials({ email });
    }

    const ttlInSec = 30 * 60;
    const token = await this.models.verificationToken.create(
      TokenType.SignIn,
      email,
      ttlInSec
    );

    const otp = this.crypto.otp();
    await this.models.magicLinkOtp.upsert(email, otp, token, clientNonce);

    const magicLink = this.url.link(callbackUrl, { token: otp, email });
    if (env.dev) {
      // make it easier to test in dev mode
      this.logger.debug(`Magic link: ${magicLink}`);
    }

    await this.auth.sendSignInEmail(email, magicLink, otp, !user);

    res.status(HttpStatus.OK).send({
      email: email,
    });
  }

  @Public()
  /**
   * @deprecated Kept for 0.25 clients that still call GET `/api/auth/sign-out`.
   * Use POST `/api/auth/sign-out` instead.
   */
  @Get('/sign-out')
  async signOutDeprecated(
    @Res() res: Response,
    @Session() session: Session | undefined,
    @Query('user_id') userId: string | undefined
  ) {
    res.setHeader('Deprecation', 'true');

    if (!session) {
      res.status(HttpStatus.OK).send({});
      return;
    }

    await this.auth.signOut(session.sessionId, userId);
    await this.auth.refreshCookies(res, session.sessionId);

    res.status(HttpStatus.OK).send({});
  }

  @Public()
  @Post('/sign-out')
  async signOut(
    @Req() req: Request,
    @Res() res: Response,
    @Session() session: Session | undefined,
    @Query('user_id') userId: string | undefined
  ) {
    if (!session) {
      res.status(HttpStatus.OK).send({});
      return;
    }

    const csrfCookie = req.cookies?.[AuthService.csrfCookieName] as
      | string
      | undefined;
    const csrfHeader = req.get('x-affine-csrf-token');
    const strictSignOutCsrf = this.config.auth.csrf.strictSignOut;
    const csrfMismatched = !csrfCookie || !csrfHeader || csrfCookie !== csrfHeader;
    if (strictSignOutCsrf && csrfMismatched) {
      this.logger.warn(
        `Reject sign-out due to CSRF mismatch (strict mode). hasCookie=${Boolean(csrfCookie)} hasHeader=${Boolean(csrfHeader)}`
      );
      throw new ActionForbidden();
    }
    if (!strictSignOutCsrf && csrfHeader && csrfCookie !== csrfHeader) {
      this.logger.warn(
        `Reject sign-out due to CSRF mismatch (compat mode). hasCookie=${Boolean(csrfCookie)} hasHeader=${Boolean(csrfHeader)}`
      );
      throw new ActionForbidden();
    }

    await this.auth.signOut(session.sessionId, userId);
    await this.auth.refreshCookies(res, session.sessionId);

    res.status(HttpStatus.OK).send({});
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/open-app/sign-in-code')
  async openAppSignInCode(@CurrentUser() user?: CurrentUser) {
    if (!user) {
      throw new ActionForbidden();
    }

    // short-lived one-time code for handing off the authenticated session
    const code = await this.models.verificationToken.create(
      TokenType.OpenAppSignIn,
      user.id,
      5 * 60
    );

    return { code };
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/open-app/sign-in')
  async openAppSignIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body() credential: OpenAppSignInCredential
  ) {
    if (!credential?.code) {
      throw new InvalidAuthState();
    }

    const tokenRecord = await this.models.verificationToken.get(
      TokenType.OpenAppSignIn,
      credential.code
    );

    if (!tokenRecord?.credential) {
      throw new InvalidAuthState();
    }

    await this.auth.setCookies(req, res, tokenRecord.credential);
    res.send({ id: tokenRecord.credential });
  }

  @Public()
  @UseNamedGuard('version')
  @Post('/magic-link')
  async magicLinkSignIn(
    @Req() req: Request,
    @Res() res: Response,
    @Body()
    { email, token: otp, client_nonce: clientNonce }: MagicLinkCredential
  ) {
    if (!otp || !email) {
      throw new EmailTokenNotFound();
    }

    validators.assertValidEmail(email);

    const consumed = await this.models.magicLinkOtp.consume(
      email,
      otp,
      clientNonce
    );
    if (!consumed.ok) {
      if (consumed.reason === 'nonce_mismatch') {
        throw new InvalidAuthState();
      }
      throw new InvalidEmailToken();
    }

    const token = consumed.token;

    const tokenRecord = await this.models.verificationToken.verify(
      TokenType.SignIn,
      token,
      {
        credential: email,
      }
    );

    if (!tokenRecord) {
      throw new InvalidEmailToken();
    }

    const user = await this.models.user.fulfill(email);

    await this.auth.setCookies(req, res, user.id);
    res.send({ id: user.id });
  }

  @UseNamedGuard('version')
  @Throttle('default', { limit: 1200 })
  @Public()
  @Get('/session')
  async currentSessionUser(@CurrentUser() user?: CurrentUser) {
    return {
      user,
    };
  }

  @Throttle('default', { limit: 1200 })
  @Public()
  @Get('/sessions')
  async currentSessionUsers(@Req() req: Request) {
    const token = req.cookies[AuthService.sessionCookieName];
    if (!token) {
      return {
        users: [],
      };
    }

    return {
      users: await this.auth.getUserList(token),
    };
  }

  private getRequestIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0]?.trim() ?? '';
    }
    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0] ?? '';
    }
    return req.ip ?? '';
  }

  private getRequestFingerprintHash(req: Request): string {
    const ip = this.getRequestIp(req);
    const userAgent = req.get('user-agent') ?? '';
    return this.crypto.sha256(`${ip}|${userAgent}`).toString('hex');
  }

  private async createAdminMfaChallenge(
    req: Request,
    userId: string,
    email: string
  ): Promise<{ ticket: string; riskLevel: 'low' | 'elevated' }> {
    const ticket = this.crypto.randomBytes(24).toString('base64url');
    const otp = this.crypto.otp();
    const otpHash = this.crypto.sha256(otp).toString('hex');
    const fingerprintHash = this.getRequestFingerprintHash(req);
    const trustedDevice = await this.sessionCache.mapGet<{ seenAt: number }>(
      `${ADMIN_TRUSTED_DEVICE_PREFIX}:${userId}`,
      fingerprintHash
    );
    const riskLevel: 'low' | 'elevated' = trustedDevice ? 'low' : 'elevated';

    await this.sessionCache.set<AdminMfaChallengeRecord>(
      `${ADMIN_MFA_CHALLENGE_PREFIX}:${ticket}`,
      {
        userId,
        email,
        otpHash,
        attempts: 0,
        riskLevel,
        fingerprintHash,
      },
      {
        ttl: this.config.auth.adminSession.mfaChallengeTtl * 1000,
      }
    );

    await this.sendAdminMfaEmail(email, ticket, otp);

    return {
      ticket,
      riskLevel,
    };
  }

  private async reissueAdminMfaChallenge(
    ticket: string,
    challenge: AdminMfaChallengeRecord
  ) {
    const otp = this.crypto.otp();
    const otpHash = this.crypto.sha256(otp).toString('hex');

    await this.sessionCache.set<AdminMfaChallengeRecord>(
      `${ADMIN_MFA_CHALLENGE_PREFIX}:${ticket}`,
      {
        ...challenge,
        otpHash,
        attempts: 0,
      },
      {
        ttl: this.config.auth.adminSession.mfaChallengeTtl * 1000,
      }
    );

    await this.sendAdminMfaEmail(challenge.email, ticket, otp);
  }

  private async sendAdminMfaEmail(email: string, ticket: string, otp: string) {
    const callbackUrl = this.url.link('/admin/auth', { mfa_ticket: ticket });
    await this.auth.sendSignInEmail(email, callbackUrl, otp, false);
  }

  private async assertAdminUser(userId: string) {
    if (!(await this.feature.isAdmin(userId))) {
      throw new ActionForbidden();
    }
  }
}
