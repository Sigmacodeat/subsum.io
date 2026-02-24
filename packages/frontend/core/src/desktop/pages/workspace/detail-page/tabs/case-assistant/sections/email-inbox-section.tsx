import { Button } from '@affine/component';
import {
  type ClientRecord,
  type EmailRecord,
  EmailService,
  type EmailStatus,
  type EmailTemplateType,
  type KanzleiProfile,
  type MatterRecord,
} from '@affine/core/modules/case-assistant';
import { useLiveData, useService } from '@toeverything/infra';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, type RefObject, useCallback, useEffect, useMemo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './email-inbox-section.css';

// ── Labels ──

const STATUS_STYLE: Record<EmailStatus, { accent: string; bg: string; label: string }> = {
  draft: { accent: cssVarV2('text/primary'), bg: cssVarV2('layer/background/secondary'), label: 'Entwurf' },
  queued: { accent: cssVarV2('text/secondary'), bg: cssVarV2('layer/background/secondary'), label: 'Wartend' },
  sending: { accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary'), label: 'Sendet…' },
  sent: { accent: cssVarV2('status/success'), bg: cssVarV2('layer/background/secondary'), label: 'Gesendet' },
  failed: { accent: cssVarV2('status/error'), bg: cssVarV2('layer/background/secondary'), label: 'Fehler' },
  bounced: { accent: cssVarV2('status/error'), bg: cssVarV2('layer/background/secondary'), label: 'Unzustellbar' },
};

// ── Helpers ──

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
  return new Date(isoDate).toLocaleDateString('de-DE');
}

function groupByThread(emails: EmailRecord[]): Map<string, EmailRecord[]> {
  const threads = new Map<string, EmailRecord[]>();
  for (const email of emails) {
    const threadKey = email.matterId
      ? `matter-${email.matterId}-${email.recipientEmail}`
      : `standalone-${email.id}`;
    if (!threads.has(threadKey)) {
      threads.set(threadKey, []);
    }
    threads.get(threadKey)!.push(email);
  }
  for (const [, thread] of threads) {
    thread.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return threads;
}

// ── Component ──

type TabId = 'alle' | 'entwuerfe' | 'gesendet' | 'fehler';

type Props = {
  sectionRef?: RefObject<HTMLElement | null>;
  workspaceId: string;
  caseId: string;
  clients: ClientRecord[];
  matters: MatterRecord[];
  clientsById: Map<string, ClientRecord>;
  kanzleiProfile?: KanzleiProfile | null;
  activeAnwaltName?: string | null;
};

export const EmailInboxSection = memo(({
  sectionRef,
  workspaceId,
  caseId,
  clients,
  matters,
  clientsById,
  kanzleiProfile,
  activeAnwaltName,
}: Props) => {
  const emailService = useService(EmailService);
  const templateList = useMemo(() => emailService.listTemplates(), [emailService]);
  const templateLabelMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of templateList) m.set(t.id, t.label);
    return m;
  }, [templateList]);

  const allEmails = (useLiveData(emailService.emails$) ?? []) as EmailRecord[];
  const emails = useMemo(
    () => allEmails.filter(e => e.workspaceId === workspaceId),
    [allEmails, workspaceId]
  );

  const [tab, setTab] = useState<TabId>('alle');
  const [expandedThreadKey, setExpandedThreadKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  // Compose form state
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeTemplate, setComposeTemplate] = useState<EmailTemplateType>('custom');
  const [composeMatterId, setComposeMatterId] = useState('');
  const [composeFristDatum, setComposeFristDatum] = useState('');
  const [composeVersicherungName, setComposeVersicherungName] = useState('');
  const [composeVersicherungsnummer, setComposeVersicherungsnummer] = useState('');
  const [composeSchadensdatum, setComposeSchadensdatum] = useState('');

  const selectedMatter = useMemo(
    () => matters.find(m => m.id === composeMatterId) ?? null,
    [matters, composeMatterId]
  );
  const selectedClient = useMemo(
    () => (selectedMatter ? clientsById.get(selectedMatter.clientId) ?? null : null),
    [selectedMatter, clientsById]
  );

  const filteredEmails = useMemo(() => {
    let msgs = emails;
    if (tab === 'entwuerfe') msgs = msgs.filter(e => e.status === 'draft');
    else if (tab === 'gesendet') msgs = msgs.filter(e => e.status === 'sent');
    else if (tab === 'fehler') msgs = msgs.filter(e => e.status === 'failed' || e.status === 'bounced');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.recipientName.toLowerCase().includes(q) ||
        e.recipientEmail.toLowerCase().includes(q) ||
        e.bodyPlainText.toLowerCase().includes(q)
      );
    }
    return msgs;
  }, [emails, tab, searchQuery]);

  const threads = useMemo(() => groupByThread(filteredEmails), [filteredEmails]);
  const sortedThreadKeys = useMemo(() => {
    return [...threads.entries()]
      .sort(([, a], [, b]) => b[0].createdAt.localeCompare(a[0].createdAt))
      .map(([key]) => key);
  }, [threads]);

  const counts = useMemo(() => ({
    alle: emails.length,
    entwuerfe: emails.filter(e => e.status === 'draft').length,
    gesendet: emails.filter(e => e.status === 'sent').length,
    fehler: emails.filter(e => e.status === 'failed' || e.status === 'bounced').length,
  }), [emails]);

  const showMessage = useCallback((msg: string, success: boolean) => {
    setSyncMessage(msg);
    setSyncSuccess(success);
  }, []);

  useEffect(() => {
    if (!syncMessage) return;
    const t = setTimeout(() => { setSyncMessage(null); setSyncSuccess(null); }, 5000);
    return () => clearTimeout(t);
  }, [syncMessage]);

  const onSendComposed = useCallback(async () => {
    if (!composeRecipient.trim() || !composeSubject.trim()) return;

    const customFields: Record<string, string> = {};
    if (composeVersicherungName.trim()) customFields.versicherungName = composeVersicherungName.trim();
    if (composeVersicherungsnummer.trim()) customFields.versicherungsnummer = composeVersicherungsnummer.trim();
    if (composeSchadensdatum.trim()) customFields.schadensdatum = composeSchadensdatum.trim();
    const templateContext =
      composeFristDatum.trim() || Object.keys(customFields).length > 0
        ? {
          ...(composeFristDatum.trim() ? { fristDatum: composeFristDatum.trim() } : {}),
          ...(Object.keys(customFields).length > 0 ? { customFields } : {}),
        }
        : undefined;

    try {
      const result = await emailService.sendEmail({
        workspaceId,
        clientId: selectedClient?.id ?? clients[0]?.id ?? caseId,
        recipientEmail: composeRecipient,
        recipientName: selectedClient?.displayName ?? composeRecipient.split('@')[0],
        templateType: composeTemplate,
        subject: composeSubject,
        bodyTemplate: composeBody,
        senderName: kanzleiProfile?.name ?? 'Kanzlei',
        senderEmail: kanzleiProfile?.email ?? 'kanzlei@subsumio.app',
        matterId: composeMatterId || undefined,
        templateContext,
      });
      showMessage(result.message, result.success);
    } catch {
      showMessage('Netzwerkfehler beim E-Mail-Versand.', false);
    }

    setComposeRecipient('');
    setComposeSubject('');
    setComposeBody('');
    setComposeFristDatum('');
    setComposeVersicherungName('');
    setComposeVersicherungsnummer('');
    setComposeSchadensdatum('');
    setIsComposing(false);
  }, [
    emailService,
    workspaceId,
    composeRecipient,
    composeSubject,
    composeBody,
    composeTemplate,
    composeMatterId,
    composeFristDatum,
    composeVersicherungName,
    composeVersicherungsnummer,
    composeSchadensdatum,
    selectedClient,
    clients,
    caseId,
    kanzleiProfile,
    showMessage,
  ]);

  const onSyncInbox = useCallback(async () => {
    setIsSyncing(true);
    try {
      const result = await emailService.syncInbox({ workspaceId, limit: 50 });
      showMessage(result.message, result.imported > 0);
    } catch {
      showMessage('Inbox-Sync fehlgeschlagen. Bitte Connector prüfen.', false);
    } finally {
      setIsSyncing(false);
    }
  }, [emailService, workspaceId, showMessage]);

  const onReplyToMessage = useCallback((msg: EmailRecord) => {
    const replyTo = msg.senderEmail || msg.recipientEmail;
    const replySubject = msg.subject.trim().toLowerCase().startsWith('re:')
      ? msg.subject
      : `Re: ${msg.subject}`;
    const signature = activeAnwaltName
      ? `\n\nMit freundlichen Grüßen\n${activeAnwaltName}${kanzleiProfile?.name ? `\n${kanzleiProfile.name}` : ''}`
      : '';
    setComposeRecipient(replyTo);
    setComposeSubject(replySubject);
    setComposeBody(`${signature}\n\n--- Ursprüngliche Nachricht ---\n${msg.bodyPlainText}`);
    setComposeTemplate('custom');
    setComposeMatterId(msg.matterId ?? '');
    setIsComposing(true);
  }, [activeAnwaltName, kanzleiProfile?.name]);

  const onResendMessage = useCallback(async (msg: EmailRecord) => {
    setResendingEmailId(msg.id);
    try {
      const fallbackClientId =
        msg.clientId ??
        clients.find(c => c.primaryEmail?.toLowerCase() === msg.recipientEmail.toLowerCase())?.id ??
        caseId;

      const result = await emailService.sendEmail({
        workspaceId,
        matterId: msg.matterId,
        clientId: fallbackClientId,
        recipientEmail: msg.recipientEmail,
        recipientName: msg.recipientName,
        templateType: msg.templateType,
        subject: msg.subject,
        bodyTemplate: msg.bodyPlainText,
        senderName: msg.senderName,
        senderEmail: msg.senderEmail,
        ccEmails: msg.ccEmails,
        bccEmails: msg.bccEmails,
        attachmentRefs: msg.attachmentRefs,
      });
      showMessage(result.message, result.success);
    } catch {
      showMessage('Erneutes Senden fehlgeschlagen.', false);
    } finally {
      setResendingEmailId(null);
    }
  }, [emailService, workspaceId, clients, caseId, showMessage]);

  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>E-Mail Postfach</h3>
        <div className={localStyles.headerActions}>
          <span className={localStyles.headerMeta}>{emails.length} E-Mails</span>
          <Button
            variant="plain"
            onClick={() => {
              onSyncInbox().catch(() => {
                // handled in onSyncInbox with UI feedback
              });
            }}
            disabled={isSyncing}
            className={localStyles.headerButton}
          >
            {isSyncing ? 'Synchronisiere…' : 'Inbox sync'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setIsComposing(v => !v)}
            className={localStyles.headerButton}
          >
            {isComposing ? 'Abbrechen' : 'Neue E-Mail'}
          </Button>
        </div>
      </div>

      {syncMessage ? (
        <p
          className={styles.status}
          aria-live="polite"
          role="status"
          style={assignInlineVars({
            [localStyles.accentColorVar]: syncSuccess === false
              ? cssVarV2('status/error')
              : syncSuccess === true
                ? cssVarV2('status/success')
                : cssVarV2('text/secondary'),
          })}
        >
          <span className={localStyles.statusText}>{syncMessage}</span>
        </p>
      ) : null}

      {/* Compose */}
      {isComposing ? (
        <div className={localStyles.composeCard}>
          <div className={localStyles.composeTitle}>Neue E-Mail verfassen</div>
          <div className={localStyles.gridTwo}>
            <label className={styles.formLabel}>
              Empfänger *
              <input
                className={styles.input}
                type="email"
                value={composeRecipient}
                onChange={e => setComposeRecipient(e.target.value)}
                placeholder="email@beispiel.de"
              />
            </label>
            <label className={styles.formLabel}>
              Vorlage
              <select
                className={styles.input}
                value={composeTemplate}
                onChange={e => setComposeTemplate(e.target.value as EmailTemplateType)}
              >
                {templateList.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.formLabel}>
            Betreff *
            <input
              className={styles.input}
              value={composeSubject}
              onChange={e => setComposeSubject(e.target.value)}
              placeholder="Betreff eingeben…"
            />
          </label>
          <label className={styles.formLabel}>
            Akte zuordnen
            <select
              className={styles.input}
              value={composeMatterId}
              onChange={e => setComposeMatterId(e.target.value)}
            >
              <option value="">— Keine Zuordnung —</option>
              {matters.map(m => {
                const client = clientsById.get(m.clientId);
                return (
                  <option key={m.id} value={m.id}>
                    {client ? `${client.displayName} — ` : ''}{m.title}
                  </option>
                );
              })}
            </select>
          </label>
          <label className={styles.formLabel}>
            Nachricht
            <textarea
              className={`${styles.input} ${localStyles.textarea}`}
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              rows={4}
              placeholder="Ihre Nachricht…"
            />
          </label>
          {composeTemplate === 'fristenwarnung' ? (
            <label className={styles.formLabel}>
              Fristdatum
              <input
                className={styles.input}
                type="date"
                value={composeFristDatum}
                onChange={e => setComposeFristDatum(e.target.value)}
              />
            </label>
          ) : null}
          {(composeTemplate === 'rechtsschutzanfrage' || composeTemplate === 'deckungszusage_erinnerung') ? (
            <div className={localStyles.gridTwo}>
              <label className={styles.formLabel}>
                Versicherung
                <input
                  className={styles.input}
                  value={composeVersicherungName}
                  onChange={e => setComposeVersicherungName(e.target.value)}
                  placeholder="z. B. ARAG"
                />
              </label>
              <label className={styles.formLabel}>
                Versicherungsschein-Nr.
                <input
                  className={styles.input}
                  value={composeVersicherungsnummer}
                  onChange={e => setComposeVersicherungsnummer(e.target.value)}
                  placeholder="Policenummer"
                />
              </label>
              <label className={styles.formLabel}>
                Schadensdatum
                <input
                  className={styles.input}
                  type="date"
                  value={composeSchadensdatum}
                  onChange={e => setComposeSchadensdatum(e.target.value)}
                />
              </label>
            </div>
          ) : null}
          <div className={localStyles.actionRowRight}>
            <Button variant="plain" onClick={() => setIsComposing(false)} className={localStyles.button11}>
              Abbrechen
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onSendComposed().catch(() => {
                  // handled in onSendComposed with UI feedback
                });
              }}
              disabled={!composeRecipient.trim() || !composeSubject.trim()}
              className={localStyles.button11}
            >
              Senden
            </Button>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className={localStyles.tabsRow}>
        {([
          { id: 'alle' as TabId, label: 'Alle', count: counts.alle },
          { id: 'entwuerfe' as TabId, label: 'Entwürfe', count: counts.entwuerfe },
          { id: 'gesendet' as TabId, label: 'Gesendet', count: counts.gesendet },
          { id: 'fehler' as TabId, label: 'Fehler', count: counts.fehler },
        ]).map(t => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'secondary' : 'plain'}
            onClick={() => setTab(t.id)}
            className={localStyles.tabButton}
          >
            {t.label}
            {t.count > 0 ? (
              <span
                className={localStyles.tabCount}
                style={assignInlineVars({
                  [localStyles.accentColorVar]: t.id === 'fehler' && t.count > 0 ? cssVarV2('status/error') : cssVarV2('text/secondary'),
                })}
              >
                ({t.count})
              </span>
            ) : null}
          </Button>
        ))}
      </div>

      {/* Suche */}
      <input
        className={`${styles.input} ${localStyles.searchInput}`}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Empfänger, Betreff, Inhalt suchen…"
      />

      {/* Thread-Liste */}
      {sortedThreadKeys.length === 0 ? (
        <div className={styles.empty}>Keine E-Mails in diesem Ordner.</div>
      ) : (
        <ul className={localStyles.list}>
          {sortedThreadKeys.map(threadKey => {
            const threadMsgs = threads.get(threadKey)!;
            const latest = threadMsgs[0];
            const isExpanded = expandedThreadKey === threadKey;
            const sty = STATUS_STYLE[latest.status];
            const matter = latest.matterId ? matters.find(m => m.id === latest.matterId) : undefined;

            return (
              <li key={threadKey} className={localStyles.threadCard}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedThreadKey(isExpanded ? null : threadKey)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedThreadKey(isExpanded ? null : threadKey); } }}
                  aria-expanded={isExpanded}
                  className={localStyles.threadHeader}
                >
                  <div className={localStyles.row}>
                    <span className={localStyles.subject}>
                      {latest.subject}
                    </span>
                    {threadMsgs.length > 1 ? (
                      <span className={localStyles.countBadge}>
                        ({threadMsgs.length})
                      </span>
                    ) : null}
                    <span
                      className={localStyles.stateBadge}
                      style={assignInlineVars({
                        [localStyles.accentColorVar]: sty.accent,
                        [localStyles.surfaceVar]: sty.bg,
                      })}
                    >
                      {sty.label}
                    </span>
                  </div>
                  <div className={localStyles.metaRow}>
                    <span>An: {latest.recipientName} &lt;{latest.recipientEmail}&gt;</span>
                    {matter ? <span className={localStyles.matterText}>{matter.title}</span> : null}
                    <span className={localStyles.mlAuto}>{formatRelativeTime(latest.createdAt)}</span>
                  </div>
                </div>

                {isExpanded ? (
                  <div className={localStyles.expanded}>
                    {threadMsgs.map(msg => (
                      <div key={msg.id} className={localStyles.messageCard}>
                        <div className={localStyles.messageMeta}>
                          <span>
                            <strong>{templateLabelMap.get(msg.templateType) ?? msg.templateType}</strong> — {new Date(msg.createdAt).toLocaleString('de-DE')}
                          </span>
                          <span
                            className={localStyles.statusStrong}
                            style={assignInlineVars({ [localStyles.accentColorVar]: STATUS_STYLE[msg.status].accent })}
                          >
                            {STATUS_STYLE[msg.status].label}
                          </span>
                        </div>
                        <div className={localStyles.messageBody}>
                          {msg.bodyPlainText || '(kein Inhalt)'}
                        </div>
                        {msg.errorMessage ? (
                          <div className={localStyles.errorText}>
                            Fehler: {msg.errorMessage}
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <div className={localStyles.actionRowRight}>
                      <Button
                        variant="plain"
                        className={localStyles.miniButton}
                        onClick={() => onReplyToMessage(threadMsgs[0])}
                      >
                        Antworten
                      </Button>
                      <Button
                        variant="plain"
                        className={localStyles.miniButton}
                        onClick={() => {
                          onResendMessage(threadMsgs[0]).catch(() => {
                            // handled in onResendMessage with UI feedback
                          });
                        }}
                        disabled={resendingEmailId === threadMsgs[0].id}
                      >
                        {resendingEmailId === threadMsgs[0].id ? 'Sende…' : 'Erneut senden'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});

EmailInboxSection.displayName = 'EmailInboxSection';
