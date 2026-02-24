import { Button } from '@affine/component';
import {
  MandantenPortalService,
  prepareLegalUploadFiles,
} from '@affine/core/modules/case-assistant';
import { useService } from '@toeverything/infra';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type PortalState = 'idle' | 'loading' | 'ready' | 'done' | 'error';
type CompletionVariant =
  | 'existing'
  | 'vollmacht_esign'
  | 'vollmacht_upload'
  | 'kyc_upload';

export const Component = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const portalService = useService(MandantenPortalService);

  const [state, setState] = useState<PortalState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [requestType, setRequestType] = useState<'vollmacht' | 'kyc' | null>(null);
  const [requestStatus, setRequestStatus] = useState<string>('');
  const [requestMode, setRequestMode] = useState<'upload' | 'esign'>('upload');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const [signerName, setSignerName] = useState('');
  const [hasSignatureStroke, setHasSignatureStroke] = useState(false);
  const [signerConsentChecked, setSignerConsentChecked] = useState(false);
  const [completionVariant, setCompletionVariant] = useState<CompletionVariant | null>(null);
  const [completionAt, setCompletionAt] = useState<string | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const primaryActionRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('Ungültiger Link: Token fehlt.');
      return;
    }

    let disposed = false;
    setState('loading');
    setError(null);
    setSelectedFiles([]);
    setRejections([]);
    setSignerName('');
    setHasSignatureStroke(false);
    setSignerConsentChecked(false);
    setCompletionVariant(null);
    setCompletionAt(null);

    portalService
      .markRequestOpenedByToken(token)
      .then(async opened => {
        if (disposed) return;
        if (!opened) {
          setState('error');
          setError('Anfrage wurde nicht gefunden oder ist ungültig.');
          return;
        }

        const resolved = await portalService.resolvePortalRequestByToken(token);
        if (!resolved) {
          setState('error');
          setError('Anfrage wurde nicht gefunden oder ist ungültig.');
          return;
        }

        setRequestType(resolved.type);
        setRequestStatus(resolved.status);
        setRequestMode(
          resolved.type === 'vollmacht' && resolved.metadata?.mode === 'esign'
            ? 'esign'
            : 'upload'
        );

        if (resolved.status === 'expired' || resolved.status === 'revoked') {
          setState('error');
          setError('Dieser Link ist nicht mehr gültig. Bitte fordern Sie einen neuen Link an.');
          return;
        }

        if (resolved.status === 'completed') {
          setCompletionVariant('existing');
          setCompletionAt(resolved.completedAt ?? new Date().toISOString());
          setState('done');
          return;
        }

        setState('ready');
      })
      .catch(err => {
        if (disposed) return;
        setState('error');
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Portals.');
      });

    return () => {
      disposed = true;
    };
  }, [portalService, token]);

  useEffect(() => {
    if (state === 'ready' || state === 'done') {
      requestAnimationFrame(() => {
        primaryActionRef.current?.focus();
      });
    }
  }, [state]);

  const completionTimestampText = useMemo(() => {
    if (!completionAt) return null;
    const date = new Date(completionAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('de-DE');
  }, [completionAt]);

  useEffect(() => {
    if (state !== 'ready' || requestType !== 'vollmacht' || requestMode !== 'esign') return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.floor(canvas.clientWidth || 560);
    const height = Math.floor(canvas.clientHeight || 180);

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'color-mix(in srgb, var(--affine-background-overlay-panel-color) 92%, transparent)';
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, Math.min(3.5, width / 220));
    ctx.strokeStyle = 'var(--affine-primary-color)';
  }, [requestMode, requestType, state]);

  const getPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const handleSignaturePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const point = getPoint(event);
    if (!point) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const handleSignaturePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const point = getPoint(event);
    if (!point) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    event.preventDefault();
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasSignatureStroke(true);
  };

  const handleSignaturePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle =
      'color-mix(in srgb, var(--affine-background-overlay-panel-color) 92%, transparent)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignatureStroke(false);
  };

  const getSignatureDataUrl = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !hasSignatureStroke) return null;
    return canvas.toDataURL('image/png');
  };

  const canSubmitSignature =
    state === 'ready' &&
    requestType === 'vollmacht' &&
    requestMode === 'esign' &&
    signerName.trim().length >= 2 &&
    signerConsentChecked &&
    hasSignatureStroke;

  const canSubmit = useMemo(() => selectedFiles.length > 0 && state === 'ready', [selectedFiles.length, state]);

  const onSubmit = async () => {
    if (!token || !requestType || !canSubmit) return;
    setState('loading');
    setError(null);
    setRejections([]);

    try {
      const prepared = await prepareLegalUploadFiles({
        files: selectedFiles,
        maxFiles: requestType === 'vollmacht' ? 1 : 6,
      });
      if (prepared.rejected.length > 0) {
        setRejections(prepared.rejected.map(item => `${item.fileName}: ${item.reason}`));
      }
      if (prepared.accepted.length === 0) {
        setState('ready');
        setError('Keine gültigen Dokumente für den Upload.');
        return;
      }

      if (requestType === 'vollmacht') {
        await portalService.completeVollmachtUploadByToken({
          token,
          document: {
            fileName: prepared.accepted[0].name,
            content: prepared.accepted[0].content,
            kind: prepared.accepted[0].kind,
            mimeType: prepared.accepted[0].mimeType,
            fileSizeBytes: prepared.accepted[0].size,
            lastModifiedAt: prepared.accepted[0].lastModifiedAt,
            pageCount: prepared.accepted[0].pageCount,
          },
        });
      } else {
        await portalService.completeKycUploadByToken({
          token,
          documents: prepared.accepted.map(file => ({
            fileName: file.name,
            content: file.content,
            kind: file.kind,
            mimeType: file.mimeType,
            fileSizeBytes: file.size,
            lastModifiedAt: file.lastModifiedAt,
            pageCount: file.pageCount,
          })),
        });
      }
      setCompletionVariant(requestType === 'vollmacht' ? 'vollmacht_upload' : 'kyc_upload');
      setCompletionAt(new Date().toISOString());
      setState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Upload konnte nicht verarbeitet werden.');
    }
  };

  const onSubmitSignature = async () => {
    const signatureDataUrl = getSignatureDataUrl();
    if (!token || !canSubmitSignature || !signatureDataUrl) return;
    setState('loading');
    setError(null);

    try {
      await portalService.completeVollmachtSignatureByToken({
        token,
        signerName: signerName.trim(),
        signatureDataUrl,
        signatureContext: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });
      setCompletionVariant('vollmacht_esign');
      setCompletionAt(new Date().toISOString());
      setState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Signatur konnte nicht verarbeitet werden.');
    }
  };

  const onSignatureKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      clearSignature();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (canSubmitSignature) {
        void onSubmitSignature();
      }
    }
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--affine-background-primary-color)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 620,
          border: '1px solid var(--affine-border-color)',
          borderRadius: 12,
          padding: 20,
          background: 'var(--affine-background-overlay-panel-color)',
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>Mandanten-Portal</h1>
        {requestType ? (
          <p style={{ marginTop: 0, opacity: 0.8 }}>
            Anfrage: <strong>{requestType === 'vollmacht' ? 'Vollmacht' : 'KYC / Identitätsnachweis'}</strong>
            {requestStatus ? ` · Status: ${requestStatus}` : ''}
          </p>
        ) : null}

        {state === 'loading' ? <p>Lädt…</p> : null}

        {state === 'error' ? (
          <p role="alert" style={{ color: 'var(--affine-error-color)' }}>
            {error ?? 'Unbekannter Fehler.'}
          </p>
        ) : null}

        {rejections.length > 0 ? (
          <ul style={{ color: 'var(--affine-warning-color, #b45309)' }}>
            {rejections.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}

        {state === 'done' ? (
          <div
            style={{
              border: '1px solid color-mix(in srgb, var(--affine-primary-color) 35%, transparent)',
              borderRadius: 12,
              padding: 14,
              background:
                'color-mix(in srgb, var(--affine-primary-color) 10%, var(--affine-background-overlay-panel-color))',
            }}
          >
            <p style={{ marginTop: 0, marginBottom: 8, color: 'var(--affine-primary-color)', fontWeight: 600 }}>
              {completionVariant === 'vollmacht_esign'
                ? 'Digitale Vollmacht erfolgreich unterschrieben'
                : completionVariant === 'vollmacht_upload'
                  ? 'Vollmacht erfolgreich übermittelt'
                  : completionVariant === 'kyc_upload'
                    ? 'KYC-Unterlagen erfolgreich übermittelt'
                    : 'Anfrage bereits abgeschlossen'}
            </p>
            {completionTimestampText ? (
              <p style={{ marginTop: 0, marginBottom: 8, opacity: 0.8 }}>
                Eingangszeit: <strong>{completionTimestampText}</strong>
              </p>
            ) : null}
            {completionVariant === 'vollmacht_esign' ? (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Ihre Signatur wurde revisionssicher gespeichert.</li>
                <li>Die Kanzlei erhält automatisch die signierte Vollmacht zur weiteren Bearbeitung.</li>
              </ul>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>Die Unterlagen wurden an die Kanzlei übermittelt.</li>
                <li>Sie werden nach rechtlicher Prüfung intern freigegeben.</li>
              </ul>
            )}
          </div>
        ) : null}

        {state === 'ready' && requestType === 'vollmacht' && requestMode === 'esign' ? (
          <>
            <p>
              Bitte unterschreiben Sie die Vollmacht direkt auf dem Smartphone/Tablet und senden Sie die Signatur sicher ab.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', marginBottom: 6 }}>Vollständiger Name</span>
              <input
                type="text"
                autoComplete="name"
                value={signerName}
                onChange={event => setSignerName(event.currentTarget.value)}
                placeholder="z. B. Max Mustermann"
                style={{
                  width: '100%',
                  borderRadius: 10,
                  border: '1px solid var(--affine-border-color)',
                  background: 'var(--affine-background-primary-color)',
                  color: 'var(--affine-text-primary-color)',
                  padding: '10px 12px',
                  fontSize: 14,
                }}
              />
            </label>
            <div style={{ marginBottom: 10 }}>
              <div style={{ marginBottom: 6 }}>Unterschrift (mit Finger oder Maus)</div>
              <div id="signature-help" style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                Tipp: Zum Löschen <strong>Esc</strong> drücken. Zum Absenden <strong>Enter</strong>.
              </div>
              <canvas
                ref={signatureCanvasRef}
                onPointerDown={handleSignaturePointerDown}
                onPointerMove={handleSignaturePointerMove}
                onPointerUp={handleSignaturePointerUp}
                onPointerLeave={handleSignaturePointerUp}
                onKeyDown={onSignatureKeyDown}
                tabIndex={0}
                role="img"
                aria-label="Unterschriftsfeld"
                aria-describedby="signature-help"
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 12,
                  border: '1px dashed var(--affine-border-color)',
                  touchAction: 'none',
                  background: 'var(--affine-background-overlay-panel-color)',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button variant="plain" onClick={clearSignature}>
                  Signatur löschen
                </Button>
              </div>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={signerConsentChecked}
                onChange={event => setSignerConsentChecked(event.currentTarget.checked)}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 13, opacity: 0.9 }}>
                Ich bestätige, dass ich diese Vollmacht selbst unterschreibe und die Angaben korrekt sind.
              </span>
            </label>
            <Button
              ref={primaryActionRef}
              variant="primary"
              disabled={!canSubmitSignature}
              onClick={onSubmitSignature}
              style={{ width: '100%' }}
            >
              Vollmacht digital unterschreiben & senden
            </Button>
            <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, opacity: 0.75 }}>
              Nach dem Absenden wird die Signatur zusammen mit Zeitstempel sicher dokumentiert.
            </p>
          </>
        ) : null}

        {state === 'ready' && (requestType !== 'vollmacht' || requestMode === 'upload') ? (
          <>
            <p>
              Bitte laden Sie die erforderlichen Unterlagen hoch und senden Sie diese zur Prüfung ab.
            </p>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ display: 'block', marginBottom: 6 }}>Dateien auswählen</span>
              <input
                type="file"
                multiple={requestType === 'kyc'}
                aria-label="Dateien auswählen"
                onChange={event => {
                  const files = Array.from(event.currentTarget.files ?? []);
                  setSelectedFiles(files);
                }}
              />
            </label>
            {selectedFiles.length > 0 ? (
              <ul>
                {selectedFiles.map(file => (
                  <li key={`${file.name}:${file.size}`}>{file.name}</li>
                ))}
              </ul>
            ) : null}
            <Button
              ref={primaryActionRef}
              variant="primary"
              disabled={!canSubmit}
              onClick={onSubmit}
              style={{ width: '100%' }}
            >
              Unterlagen senden
            </Button>
          </>
        ) : null}
      </section>
    </main>
  );
};
