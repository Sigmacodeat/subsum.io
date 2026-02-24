import { Button } from '@affine/component';
import {
  BEA_STATUS_LABELS,
  BeAConnectorService,
  type BeAConnection,
  type BeAMessage,
  type BeAMessageStatus,
} from '@affine/core/modules/case-assistant';
import { useService } from '@toeverything/infra';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useCallback, useEffect, useMemo, useState, type RefObject } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './bea-postfach-section.css';

type BeaMessagePriority = 'normal' | 'urgent' | 'court';

// ── Labels ──

const STATUS_STYLE: Record<BeAMessageStatus, { accent: string; bg: string; label: string }> = {
  draft: { accent: cssVarV2('text/primary'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.draft },
  signed: { accent: cssVarV2('text/secondary'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.signed },
  queued: { accent: cssVarV2('text/secondary'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.queued },
  sending: { accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.sending },
  sent: { accent: cssVarV2('status/success'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.sent },
  delivered: { accent: cssVarV2('button/primary'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.delivered },
  acknowledged: { accent: cssVarV2('status/success'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.acknowledged },
  failed: { accent: cssVarV2('status/error'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.failed },
  rejected: { accent: cssVarV2('status/error'), bg: cssVarV2('layer/background/secondary'), label: BEA_STATUS_LABELS.rejected },
};

const PRIORITY_STYLE: Record<BeaMessagePriority, { accent: string; label: string }> = {
  normal: { accent: cssVarV2('text/secondary'), label: '' },
  urgent: { accent: cssVarV2('status/error'), label: 'Eilig' },
  court: { accent: cssVarV2('button/primary'), label: 'Gericht' },
};

// ── Helpers ──

function getMessagePriority(message: BeAMessage): BeaMessagePriority {
  const subject = message.subject.toLowerCase();
  if (
    message.recipientCourt ||
    message.gerichtsaktenzeichen ||
    subject.includes('ladung') ||
    subject.includes('verhandlung')
  ) {
    return 'court';
  }
  if (message.empfangsbekenntnisRequired || subject.includes('frist') || subject.includes('eilig')) {
    return 'urgent';
  }
  return 'normal';
}

function getMessageTimestamp(message: BeAMessage): string {
  return message.deliveredAt ?? message.sentAt ?? message.createdAt;
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? 'en' : ''}`;
}

// ── Component ──

type TabId = 'inbox' | 'outbox' | 'drafts';

type Props = {
  sectionRef?: RefObject<HTMLElement | null>;
  workspaceId: string;
  connectorStatus?: 'connected' | 'disconnected' | 'error';
};

export const BeaPostfachSection = memo(({ sectionRef, workspaceId, connectorStatus = 'disconnected' }: Props) => {
  const beaConnectorService = useService(BeAConnectorService);
  const [connections, setConnections] = useState<BeAConnection[]>([]);
  const [serviceMessages, setServiceMessages] = useState<BeAMessage[]>([]);

  const [tab, setTab] = useState<TabId>('inbox');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState<boolean | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [composeRecipientSafeId, setComposeRecipientSafeId] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [forwardingId, setForwardingId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const showStatus = useCallback((msg: string, ok: boolean) => {
    setStatusMessage(msg);
    setStatusOk(ok);
  }, []);

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => { setStatusMessage(null); setStatusOk(null); }, 5000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  useEffect(() => {
    const connSub = beaConnectorService.connectionsList$.subscribe(setConnections);
    const msgSub = beaConnectorService.messagesList$.subscribe(setServiceMessages);
    return () => {
      connSub.unsubscribe();
      msgSub.unsubscribe();
    };
  }, [beaConnectorService]);

  const activeConnection = useMemo(
    () =>
      connections.find(
        connection =>
          connection.workspaceId === workspaceId &&
          (connection.provider === 'bea' || connection.provider === 'web_erv')
      ) ?? null,
    [connections, workspaceId]
  );

  const resolvedConnectorStatus =
    activeConnection?.status === 'connected'
      ? 'connected'
      : activeConnection?.status === 'error' ||
          activeConnection?.status === 'certificate_expired'
        ? 'error'
        : connectorStatus;

  const allMessages = useMemo(
    () =>
      serviceMessages
        .filter(
          message =>
            message.workspaceId === workspaceId &&
            (!activeConnection || message.connectionId === activeConnection.id)
        )
        .sort(
          (a, b) =>
            new Date(getMessageTimestamp(b)).getTime() -
            new Date(getMessageTimestamp(a)).getTime()
        ),
    [activeConnection, serviceMessages, workspaceId]
  );

  const filteredMessages = useMemo(() => {
    let msgs = allMessages;
    if (tab === 'inbox') msgs = msgs.filter(m => m.direction === 'incoming');
    else if (tab === 'outbox') msgs = msgs.filter(m => m.direction === 'outgoing' && m.status !== 'draft');
    else if (tab === 'drafts') msgs = msgs.filter(m => m.status === 'draft');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      msgs = msgs.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.recipientName.toLowerCase().includes(q) ||
        (m.gerichtsaktenzeichen ?? '').toLowerCase().includes(q) ||
        (m.aktenzeichen ?? '').toLowerCase().includes(q)
      );
    }
    return msgs;
  }, [allMessages, tab, searchQuery]);

  const unreadCount = useMemo(
    () =>
      allMessages.filter(
        m =>
          m.direction === 'incoming' &&
          (m.status === 'delivered' || m.status === 'sent')
      ).length,
    [allMessages]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  }, []);

  const onReply = useCallback((msg: BeAMessage) => {
    setReplyingToId(msg.id);
    setComposeRecipient(msg.senderName);
    setComposeRecipientSafeId(msg.senderSafeId ?? '');
    setComposeSubject(msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`);
    setComposeBody('');
    setIsComposing(true);
    setForwardingId(null);
  }, []);

  const onForward = useCallback((msg: BeAMessage) => {
    setForwardingId(msg.id);
    setReplyingToId(null);
    setComposeRecipient('');
    setComposeRecipientSafeId('');
    setComposeSubject(`Fwd: ${msg.subject}`);
    setComposeBody(`\n\n--- Weitergeleitete Nachricht ---\nVon: ${msg.senderName}\nBetreff: ${msg.subject}`);
    setIsComposing(true);
  }, []);

  const onAssign = useCallback((msg: BeAMessage) => {
    setAssigningId(msg.id);
    showStatus(`Nachricht "${msg.subject.slice(0, 40)}" zur Akte zugeordnet.`, true);
    setAssigningId(null);
    setExpandedId(null);
  }, [showStatus]);

  const onSubmitEmpfangsbekenntnis = useCallback(
    async (msg: BeAMessage) => {
      if (!msg.empfangsbekenntnisRequired) {
        return;
      }
      setAcknowledgingId(msg.id);
      try {
        const ok = await beaConnectorService.submitEmpfangsbekenntnis(
          msg.id,
          'case-assistant-panel'
        );
        showStatus(
          ok
            ? 'Empfangsbekenntnis wurde erfolgreich übermittelt.'
            : 'Empfangsbekenntnis konnte nicht übermittelt werden.',
          ok
        );
      } finally {
        setAcknowledgingId(null);
      }
    },
    [beaConnectorService, showStatus]
  );

  const onRefresh = useCallback(async () => {
    if (!activeConnection || resolvedConnectorStatus !== 'connected') {
      showStatus('Kein aktiver beA-Connector. Bitte Verbindung prüfen.', false);
      return;
    }
    setIsRefreshing(true);
    try {
      const result = await beaConnectorService.checkInbox(activeConnection.id);
      const isOk = !result.message.toLowerCase().includes('fehler');
      showStatus(result.message, isOk);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeConnection, beaConnectorService, resolvedConnectorStatus, showStatus]);

  const onSendCompose = useCallback(async () => {
    if (
      !activeConnection ||
      !composeRecipient.trim() ||
      !composeRecipientSafeId.trim() ||
      !composeSubject.trim()
    ) {
      return;
    }

    setIsSending(true);
    try {
      const draft = await beaConnectorService.createOutgoingMessage({
        workspaceId,
        connectionId: activeConnection.id,
        recipientSafeId: composeRecipientSafeId.trim(),
        recipientName: composeRecipient.trim(),
        subject: composeSubject,
        bodyText: composeBody,
        attachments: [],
      });
      const sent = await beaConnectorService.signAndSend(
        draft.id,
        'case-assistant-panel',
        'qes'
      );

      const ok = sent?.status === 'sent' || sent?.status === 'delivered';
      showStatus(ok ? 'Nachricht erfolgreich gesendet.' : 'Nachricht konnte nicht zugestellt werden.', Boolean(ok));

      setIsComposing(false);
      setComposeRecipient('');
      setComposeRecipientSafeId('');
      setComposeSubject('');
      setComposeBody('');
      setReplyingToId(null);
      setForwardingId(null);
    } catch (error) {
      showStatus(
        error instanceof Error ? error.message : 'Nachricht konnte nicht gesendet werden.',
        false
      );
    } finally {
      setIsSending(false);
    }
  }, [
    activeConnection,
    beaConnectorService,
    composeBody,
    composeRecipient,
    composeRecipientSafeId,
    composeSubject,
    showStatus,
    workspaceId,
  ]);

  const statusColor =
    resolvedConnectorStatus === 'connected'
      ? cssVarV2('status/success')
      : resolvedConnectorStatus === 'error'
        ? cssVarV2('status/error')
        : cssVarV2('text/primary');
  const statusLabel =
    resolvedConnectorStatus === 'connected'
      ? 'Verbunden'
      : resolvedConnectorStatus === 'error'
        ? 'Fehler'
        : 'Nicht verbunden';

  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>beA / webERV Postfach</h3>
        <div className={localStyles.connectorRow}>
          <span
            className={localStyles.statusDot}
            style={assignInlineVars({ [localStyles.accentColorVar]: statusColor })}
          />
          <span
            className={localStyles.statusLabel}
            style={assignInlineVars({ [localStyles.accentColorVar]: statusColor })}
          >{statusLabel}</span>
          {unreadCount > 0 ? (
            <span className={localStyles.unreadBadge}>
              {unreadCount} neu
            </span>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <p
          className={styles.status}
          aria-live="polite"
          role="status"
          style={assignInlineVars({
            [localStyles.accentColorVar]: statusOk === false
              ? cssVarV2('status/error')
              : statusOk === true
                ? cssVarV2('status/success')
                : cssVarV2('text/secondary'),
          })}
        >
          <span className={localStyles.statusText}>{statusMessage}</span>
        </p>
      ) : null}

      {resolvedConnectorStatus === 'disconnected' ? (
        <div className={`${styles.empty} ${localStyles.disconnectedEmpty}`}>
          <div className={localStyles.disconnectedTitle}>beA-Connector nicht konfiguriert</div>
          <div className={localStyles.disconnectedHint}>
            Bitte konfigurieren Sie den beA/webERV-Connector unter Einstellungen, um Ihr Postfach zu verbinden.
          </div>
        </div>
      ) : (
        <>
          {/* Tab-Leiste */}
          <div className={localStyles.tabsRow}>
            {([
              { id: 'inbox' as TabId, label: 'Posteingang', count: unreadCount },
              { id: 'outbox' as TabId, label: 'Postausgang', count: allMessages.filter(m => m.direction === 'outgoing' && m.status !== 'draft').length },
              { id: 'drafts' as TabId, label: 'Entwürfe', count: allMessages.filter(m => m.status === 'draft').length },
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
                    style={assignInlineVars({ [localStyles.accentColorVar]: t.id === 'inbox' ? cssVarV2('button/primary') : cssVarV2('text/secondary') })}
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
            placeholder="Betreff, Absender, Aktenzeichen suchen…"
          />

          {/* Nachrichten-Liste */}
          {filteredMessages.length === 0 ? (
            <div className={styles.empty}>Keine Nachrichten in diesem Ordner.</div>
          ) : (
            <ul className={localStyles.messageList}>
              {filteredMessages.map(msg => {
                const isUnread = msg.direction === 'incoming' && (msg.status === 'delivered' || msg.status === 'sent');
                const sty = STATUS_STYLE[msg.status];
                const priSty = PRIORITY_STYLE[getMessagePriority(msg)];
                const isExpanded = expandedId === msg.id;
                return (
                  <li key={msg.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpand(msg.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(msg.id); } }}
                      aria-expanded={isExpanded}
                      className={`${localStyles.messageCard} ${isUnread ? localStyles.messageCardUnread : ''}`}
                    >
                      <div className={localStyles.row}>
                        <span className={`${localStyles.subject} ${isUnread ? localStyles.subjectUnread : ''}`}>
                          {msg.subject}
                        </span>
                        {priSty.label ? (
                          <span
                            className={localStyles.priorityBadge}
                            style={assignInlineVars({ [localStyles.accentColorVar]: priSty.accent })}
                          >
                            {priSty.label}
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
                        <span>{msg.direction === 'incoming' ? `Von: ${msg.senderName}` : `An: ${msg.recipientName}`}</span>
                        {msg.gerichtsaktenzeichen ? <span className={localStyles.courtRef}>Az. {msg.gerichtsaktenzeichen}</span> : null}
                        {msg.attachments.length > 0 ? <span>{msg.attachments.length} Anlage{msg.attachments.length > 1 ? 'n' : ''}</span> : null}
                        <span className={localStyles.pushRight}>{formatRelativeTime(getMessageTimestamp(msg))}</span>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className={localStyles.expandedPanel}>
                        <div className={localStyles.detailsGrid}>
                          <div><strong>Absender:</strong> {msg.senderName}{msg.senderSafeId ? ` (${msg.senderSafeId})` : ''}</div>
                          <div><strong>Empfänger:</strong> {msg.recipientName}{msg.recipientSafeId ? ` (${msg.recipientSafeId})` : ''}</div>
                          {msg.gerichtsaktenzeichen ? <div><strong>Aktenzeichen:</strong> {msg.gerichtsaktenzeichen}</div> : null}
                          {msg.aktenzeichen ? <div><strong>Interne Ref.:</strong> {msg.aktenzeichen}</div> : null}
                          <div><strong>Empfangen:</strong> {new Date(getMessageTimestamp(msg)).toLocaleString('de-DE')}</div>
                          {msg.sentAt ? <div><strong>Gesendet:</strong> {new Date(msg.sentAt).toLocaleString('de-DE')}</div> : null}
                        </div>
                        {msg.attachments.length > 0 ? (
                          <div className={localStyles.attachmentInfo}>
                            {msg.attachments.length} Anlage{msg.attachments.length > 1 ? 'n' : ''} — Klicken zum Herunterladen
                          </div>
                        ) : null}
                        <div className={localStyles.actionRow}>
                          {msg.direction === 'incoming' && msg.status !== 'acknowledged' ? (
                            <Button
                              variant="secondary"
                              className={localStyles.miniButton}
                              onClick={() => onReply(msg)}
                            >
                              Antworten
                            </Button>
                          ) : null}
                          <Button
                            variant="plain"
                            className={localStyles.miniButton}
                            onClick={() => onAssign(msg)}
                            disabled={assigningId === msg.id}
                          >
                            {assigningId === msg.id ? 'Zuordnen…' : 'Zur Akte zuordnen'}
                          </Button>
                          <Button
                            variant="plain"
                            className={localStyles.miniButton}
                            onClick={() => onForward(msg)}
                          >
                            Weiterleiten
                          </Button>
                          {msg.direction === 'incoming' && msg.empfangsbekenntnisRequired && !msg.empfangsbekenntnisSubmittedAt ? (
                            <Button
                              variant="plain"
                              className={localStyles.miniButton}
                              onClick={() => onSubmitEmpfangsbekenntnis(msg)}
                              disabled={acknowledgingId === msg.id}
                            >
                              {acknowledgingId === msg.id ? 'Übermittle EB…' : 'Empfangsbekenntnis'}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Compose-Formular */}
          {isComposing ? (
            <div className={localStyles.composeBox}>
              <div className={localStyles.composeTitle}>
                {replyingToId ? 'Antwort verfassen' : forwardingId ? 'Nachricht weiterleiten' : 'Neue Nachricht verfassen'}
              </div>
              <label className={styles.formLabel}>
                Empfänger
                <input
                  className={styles.input}
                  value={composeRecipient}
                  onChange={e => setComposeRecipient(e.target.value)}
                  placeholder="Name des Empfängers"
                />
              </label>
              <label className={styles.formLabel}>
                Empfänger SAFE-ID
                <input
                  className={styles.input}
                  value={composeRecipientSafeId}
                  onChange={e => setComposeRecipientSafeId(e.target.value)}
                  placeholder="z.B. DE.BRAK.12345678"
                />
              </label>
              <label className={styles.formLabel}>
                Betreff
                <input
                  className={styles.input}
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Betreff eingeben…"
                />
              </label>
              <label className={styles.formLabel}>
                Nachricht
                <textarea
                  className={`${styles.input} ${localStyles.composeTextarea}`}
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  rows={4}
                  placeholder="Ihre Nachricht…"
                />
              </label>
              <div className={localStyles.composeActions}>
                <Button
                  variant="plain"
                  className={localStyles.composeButton}
                  onClick={() => { setIsComposing(false); setReplyingToId(null); setForwardingId(null); }}
                >
                  Abbrechen
                </Button>
                <Button
                  variant="secondary"
                  className={localStyles.composeButton}
                  disabled={!composeRecipient.trim() || !composeRecipientSafeId.trim() || !composeSubject.trim() || isSending}
                  onClick={onSendCompose}
                >
                  {isSending ? 'Sende…' : 'Senden'}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Neue Nachricht */}
          <div className={localStyles.footerActions}>
            <Button
              variant="secondary"
              className={localStyles.footerButton}
              onClick={() => {
                setIsComposing(v => !v);
                setReplyingToId(null);
                setForwardingId(null);
                setComposeRecipient('');
                setComposeRecipientSafeId('');
                setComposeSubject('');
                setComposeBody('');
              }}
            >
              {isComposing ? 'Abbrechen' : 'Neue Nachricht verfassen'}
            </Button>
            <Button
              variant="plain"
              className={localStyles.footerButton}
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Aktualisiere…' : 'Postfach aktualisieren'}
            </Button>
          </div>
        </>
      )}
    </section>
  );
});

BeaPostfachSection.displayName = 'BeaPostfachSection';
