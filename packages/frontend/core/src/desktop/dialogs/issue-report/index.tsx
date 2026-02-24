import { Button, Modal } from '@affine/component';
import type { DialogComponentProps } from '@affine/core/modules/dialogs';
import type { WORKSPACE_DIALOG_SCHEMA } from '@affine/core/modules/dialogs/constant';
import { GlobalContextService } from '@affine/core/modules/global-context';
import { useI18n } from '@affine/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

type ReportSubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; id: string }
  | { status: 'error'; message: string };

function captureViewportScreenshot(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const w = Math.max(1, Math.min(window.innerWidth, 1920));
    const h = Math.max(1, Math.min(window.innerHeight, 1080));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#0c0d10';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#ececf0';
    ctx.font = '14px ui-sans-serif, system-ui, -apple-system';
    ctx.fillText('Screenshot capture not available in this environment.', 16, 32);
    ctx.fillStyle = '#8b8b94';
    ctx.fillText(`${location.pathname}`, 16, 56);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export const IssueReportDialog = ({
  close,
  presetTitle,
  presetDescription,
}: DialogComponentProps<WORKSPACE_DIALOG_SCHEMA['issue-report']>) => {
  const t = useI18n();
  const globalContextService = useService(GlobalContextService);
  const workspaceId = useLiveData(globalContextService.globalContext.workspaceId.$);

  const [title, setTitle] = useState(presetTitle ?? '');
  const [description, setDescription] = useState(presetDescription ?? '');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [state, setState] = useState<ReportSubmitState>({ status: 'idle' });

  const canSubmit = Boolean(workspaceId) && description.trim().length > 0;

  const diagnostics = useMemo(() => {
    return {
      url: location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
    };
  }, []);

  const onSubmit = useCallback(async () => {
    if (!workspaceId) return;
    if (!canSubmit) return;

    setState({ status: 'submitting' });

    const screenshotDataUrl = includeScreenshot ? captureViewportScreenshot() : null;

    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/issue-reports`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-affine-version': BUILD_CONFIG.appVersion,
        },
        body: JSON.stringify({
          app: BUILD_CONFIG.isElectron ? 'electron' : 'web',
          title: title.trim() || undefined,
          description: description.trim(),
          route: location.pathname,
          diagnostics,
          appVersion: BUILD_CONFIG.appVersion,
          distribution: BUILD_CONFIG.distribution,
          buildType: BUILD_CONFIG.appBuildType,
          screenshot: screenshotDataUrl
            ? {
                name: 'screenshot.png',
                dataUrl: screenshotDataUrl,
              }
            : undefined,
        }),
      });

      const data = (await res.json()) as any;
      if (!res.ok || !data?.ok) {
        setState({
          status: 'error',
          message: data?.error ? String(data.error) : 'submit_failed',
        });
        return;
      }

      setState({ status: 'success', id: String(data.id) });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'submit_failed',
      });
    }
  }, [workspaceId, canSubmit, includeScreenshot, title, description, diagnostics]);

  return (
    <Modal
      open
      onOpenChange={open => {
        if (!open) close();
      }}
      width={560}
      contentOptions={{
        style: {
          maxHeight: '85vh',
          overflow: 'hidden',
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{t['Feedback']()}</div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>
          {workspaceId ? null : t['com.affine.error.unexpected-error.title']()}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Titel (optional)</div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{
              width: '100%',
              height: 36,
              borderRadius: 10,
              border: '1px solid var(--affine-border-color)',
              padding: '0 12px',
              background: 'var(--affine-background-primary-color)',
              color: 'var(--affine-text-primary-color)',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Beschreibung</div>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Was ist passiert? Was hast du erwartet?"
            style={{
              width: '100%',
              minHeight: 120,
              borderRadius: 10,
              border: '1px solid var(--affine-border-color)',
              padding: '10px 12px',
              background: 'var(--affine-background-primary-color)',
              color: 'var(--affine-text-primary-color)',
              resize: 'vertical',
              lineHeight: 1.45,
            }}
          />
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <input
            type="checkbox"
            checked={includeScreenshot}
            onChange={e => setIncludeScreenshot(e.target.checked)}
          />
          Screenshot anhängen (wenn möglich)
        </label>

        {state.status === 'success' ? (
          <div style={{ fontSize: 12 }}>Gesendet. Ticket-ID: {state.id}</div>
        ) : state.status === 'error' ? (
          <div style={{ fontSize: 12, color: 'var(--affine-error-color)' }}>
            Fehler beim Senden: {state.message}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <Button
            variant="secondary"
            onClick={() => close()}
            disabled={state.status === 'submitting'}
          >
            Schließen
          </Button>
          <Button
            variant="primary"
            onClick={onSubmit}
            disabled={!canSubmit || state.status === 'submitting'}
          >
            {state.status === 'submitting' ? 'Senden…' : 'Senden'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
