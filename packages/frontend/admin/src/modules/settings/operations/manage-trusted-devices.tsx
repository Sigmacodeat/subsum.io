import { Button } from '../../../components/ui/button';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { affineFetch } from '../../../fetch-utils';

interface TrustedDevice {
  fingerprint: string;
  seenAt: number;
}

interface TrustedDevicesResponse {
  devices: TrustedDevice[];
}

export function ManageTrustedDevices() {
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await affineFetch('/api/auth/admin/trusted-devices', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to load trusted devices');
      }

      const data = (await response.json()) as TrustedDevicesResponse;
      setDevices(data.devices);
    } catch (err: any) {
      toast.error(`Failed to load devices: ${err.message}`);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices().catch(console.error);
  }, [loadDevices]);

  const revokeDevice = useCallback(
    async (fingerprint: string) => {
      setIsLoading(true);
      try {
        const response = await affineFetch(
          `/api/auth/admin/trusted-devices?fingerprint=${encodeURIComponent(fingerprint)}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error('Failed to revoke device');
        }

        toast.success('Device revoked successfully');
        await loadDevices();
      } catch (err: any) {
        toast.error(`Failed to revoke device: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [loadDevices]
  );

  const revokeAllDevices = useCallback(async () => {
    if (!confirm('Revoke all trusted devices? You will need MFA on next login.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await affineFetch('/api/auth/admin/trusted-devices', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke all devices');
      }

      toast.success('All devices revoked successfully');
      await loadDevices();
    } catch (err: any) {
      toast.error(`Failed to revoke devices: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [loadDevices]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('de-AT', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  const formatFingerprint = (fp: string) => {
    if (fp.length <= 16) return fp;
    return `${fp.slice(0, 8)}...${fp.slice(-8)}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Trusted Devices</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Manage devices that skip MFA step-up for admin login
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadDevices()}
            disabled={isRefreshing || isLoading}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          {devices.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={revokeAllDevices}
              disabled={isLoading || isRefreshing}
            >
              Revoke All
            </Button>
          )}
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg">
          No trusted devices found
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map(device => (
            <div
              key={device.fingerprint}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex-1">
                <div className="text-sm font-mono">
                  {formatFingerprint(device.fingerprint)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Last seen: {formatDate(device.seenAt)}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => revokeDevice(device.fingerprint)}
                disabled={isLoading || isRefreshing}
              >
                Revoke
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
