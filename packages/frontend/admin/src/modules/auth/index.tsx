import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { FeatureType, getUserFeaturesQuery } from '@affine/graphql';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';

import { affineFetch } from '../../fetch-utils';
import { isAdmin, useCurrentUser, useRevalidateCurrentUser } from '../common';
import logo from './logo.svg';

interface AdminSignInResponse {
  mfaRequired?: boolean;
  ticket?: string;
  email?: string;
  riskLevel?: 'low' | 'elevated';
}

export function Auth() {
  const currentUser = useCurrentUser();
  const revalidate = useRevalidateCurrentUser();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [mfaEmail, setMfaEmail] = useState<string>('');
  const [mfaCode, setMfaCode] = useState<string>('');
  const [riskLevel, setRiskLevel] = useState<'low' | 'elevated' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const validateAdminAccess = useCallback(async () => {
    const res = await affineFetch('/graphql', {
      method: 'POST',
      body: JSON.stringify({
        operationName: getUserFeaturesQuery.op,
        query: getUserFeaturesQuery.query,
        variables: {},
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error('Failed to validate admin permissions');
    }

    const payload = await res.json();
    const features = payload?.data?.currentUser?.features ?? [];
    const hasAdminAccess = features.includes(FeatureType.Admin);

    if (hasAdminAccess) {
      toast.success('Login successful');
      await revalidate();
      return;
    }

    await affineFetch('/api/auth/sign-out', {
      method: 'POST',
    });
    throw new Error('This account has no admin access');
  }, [revalidate]);

  const login = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!emailRef.current || !passwordRef.current || isLoading) return;

      setIsLoading(true);
      try {
        const response = await affineFetch('/api/auth/sign-in', {
        method: 'POST',
        body: JSON.stringify({
          email: emailRef.current?.value,
          password: passwordRef.current?.value,
          admin_step_up: true,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        });

        if (response.status === 202) {
          const pending = (await response.json()) as AdminSignInResponse;
          if (!pending.mfaRequired || !pending.ticket) {
            throw new Error('Invalid MFA challenge response');
          }
          setMfaTicket(pending.ticket);
          setMfaEmail(pending.email ?? emailRef.current.value);
          setRiskLevel(pending.riskLevel ?? null);
          setMfaCode('');
          toast.info('Bitte MFA-Code aus deiner E-Mail eingeben');
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to login');
        }

        await validateAdminAccess();
      } catch (err: any) {
        toast.error(`Login failed: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, validateAdminAccess]
  );

  const verifyMfa = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!mfaTicket || !mfaCode || isLoading) {
        return;
      }

      setIsLoading(true);
      try {
        const response = await affineFetch('/api/auth/admin/verify-mfa', {
          method: 'POST',
          body: JSON.stringify({
            ticket: mfaTicket,
            otp: mfaCode,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to verify MFA');
        }

        await validateAdminAccess();
      } catch (err: any) {
        toast.error(`MFA failed: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, mfaCode, mfaTicket, validateAdminAccess]
  );

  const resetMfa = useCallback(() => {
    setMfaTicket(null);
    setMfaCode('');
    setMfaEmail('');
    setRiskLevel(null);
    setResendCooldown(0);
  }, []);

  const resendMfa = useCallback(async () => {
    if (!mfaTicket || resendCooldown > 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await affineFetch('/api/auth/admin/resend-mfa', {
        method: 'POST',
        body: JSON.stringify({
          ticket: mfaTicket,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to resend MFA code');
      }

      toast.success('MFA code resent to your email');
      setResendCooldown(60);
      setMfaCode('');
    } catch (err: any) {
      toast.error(`Resend failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mfaTicket, resendCooldown]);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);

  if (currentUser && isAdmin(currentUser)) {
    return <Navigate to="/admin" />;
  }

  return (
    <div className="w-full lg:grid lg:min-h-[600px] lg:grid-cols-2 xl:min-h-[800px] h-dvh">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold">Subsumio Admin</h1>
            <p className="text-balance text-muted-foreground">
              {mfaTicket
                ? 'Bestätige deinen Login mit MFA'
                : 'Sign in with your admin account'}
            </p>
          </div>
          {!mfaTicket ? (
            <form onSubmit={login} action="#">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    ref={emailRef}
                    placeholder="m@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="password">Password</Label>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    ref={passwordRef}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={verifyMfa} action="#">
              <div className="grid gap-4">
                <div className="text-sm text-muted-foreground">
                  MFA code sent to <strong>{mfaEmail}</strong>
                  {riskLevel === 'elevated'
                    ? ' (neues Gerät erkannt)'
                    : ''}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="mfa-code">Verification Code</Label>
                  <Input
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Verifying...' : 'Verify MFA'}
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resendMfa}
                    disabled={isLoading || resendCooldown > 0}
                  >
                    {resendCooldown > 0
                      ? `Resend (${resendCooldown}s)`
                      : 'Resend Code'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={resetMfa}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
      <div className="hidden bg-muted lg:flex lg:justify-center">
        <img
          src={logo}
          alt="Image"
          className="h-1/2 object-cover dark:brightness-[0.2] dark:grayscale relative top-1/4 "
        />
      </div>
    </div>
  );
}

export { Auth as Component };
