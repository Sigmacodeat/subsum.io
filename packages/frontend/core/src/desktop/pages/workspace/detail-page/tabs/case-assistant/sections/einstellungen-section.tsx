import { Button } from '@affine/component';
import type {
  CaseAssistantAction,
  CaseAssistantRole,
  ConnectorConfig,
  Jurisdiction,
  WorkspaceResidencyMode,
  WorkspaceResidencyPolicy,
} from '@affine/core/modules/case-assistant';
import { useI18n } from '@affine/i18n';
import { memo, type RefObject } from 'react';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { cssVarV2 } from '@toeverything/theme/v2';

import * as styles from '../../case-assistant.css';
import type { ConnectorDraft } from '../panel-types';
import * as localStyles from './einstellungen-section.css';

type RotationMode = 'soft' | 'hard';

type ConnectorCard = {
  connector: ConnectorConfig;
  credentialMeta: {
    hasSecret: boolean;
    updatedAt?: string | null;
  };
  rotationDays: number;
  rotationMode: RotationMode;
  rotationDue: boolean;
};

type Props = {
  sectionRef: RefObject<HTMLElement | null>;

  currentRole: CaseAssistantRole;
  onRoleChange: (role: CaseAssistantRole) => void;

  currentJurisdiction: Jurisdiction;
  onJurisdictionChange: (jurisdiction: Jurisdiction) => void;
  jurisdictionOptions: Array<{
    id: Jurisdiction;
    label: string;
    flag: string;
  }>;

  themeMode: 'system' | 'light' | 'dark';
  onThemeModeChange: (mode: 'system' | 'light' | 'dark') => void;

  residencyPolicyDraft: WorkspaceResidencyPolicy;
  onResidencyPolicyDraftChange: (
    patch: Partial<WorkspaceResidencyPolicy>
  ) => void;
  onSaveResidencyPolicy: () => Promise<void>;

  connectorCards: ConnectorCard[];
  connectorDrafts: Record<string, ConnectorDraft>;

  canAction: (action: CaseAssistantAction) => boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;

  onConnectorDraftChange: (connectorId: string, patch: Partial<ConnectorDraft>) => void;
  onRotateConnectorCredential: (connectorId: string) => Promise<void>;
  onSaveConnectorSettings: (connectorId: string) => Promise<void>;
  onToggleConnector: (connectorId: string, enabled: boolean) => Promise<void>;
  onHealthcheckConnector: (connectorId: string) => Promise<void>;
  onClearConnectorCredential: (connectorId: string) => Promise<void>;

  formatSecretUpdatedAt: (value?: string | null) => string;
  normalizeRotationMode: (value: string | undefined) => RotationMode;

  ingestionStatus: string | null;
  statusTone: 'info' | 'error';
};

export const EinstellungenSection = memo((props: Props) => {
  const t = useI18n();

  return (
    <section ref={props.sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>
          {t['com.affine.caseAssistant.settings.section.title']()}
        </h3>
      </div>

      {/* ── Rolle ── */}
      <div className={localStyles.controlRowSpaced}>
        <div className={styles.controlRow}>
        <label className={styles.formLabel}>
          {t['com.affine.caseAssistant.settings.role.label']()}
          <select
            className={styles.input}
            value={props.currentRole}
            onChange={event => {
              props.onRoleChange(event.target.value as CaseAssistantRole);
            }}
          >
            <option value="viewer">
              {t['com.affine.caseAssistant.settings.role.viewer']()}
            </option>
            <option value="operator">
              {t['com.affine.caseAssistant.settings.role.operator']()}
            </option>
            <option value="admin">
              {t['com.affine.caseAssistant.settings.role.admin']()}
            </option>
            <option value="owner">
              {t['com.affine.caseAssistant.settings.role.owner']()}
            </option>
          </select>
        </label>
        <p className={localStyles.summaryTight}>
          <span className={styles.summary}>
          {t['com.affine.caseAssistant.settings.role.description']()}
          </span>
        </p>
        </div>
      </div>

      {/* ── Jurisdiktion ── */}
      <div className={localStyles.controlRowSpaced}>
        <div className={styles.controlRow}>
        <label className={styles.formLabel}>
          {t['com.affine.caseAssistant.settings.jurisdiction.label']()}
          <select
            className={styles.input}
            value={props.currentJurisdiction}
            onChange={event => {
              props.onJurisdictionChange(event.target.value as Jurisdiction);
            }}
          >
            {props.jurisdictionOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.flag} {option.label}
              </option>
            ))}
          </select>
        </label>
        <p className={localStyles.summaryTight}>
          <span className={styles.summary}>
          {t['com.affine.caseAssistant.settings.jurisdiction.description']()}
          </span>
        </p>
        </div>
      </div>

      {/* ── Theme / Design ── */}
      <div className={localStyles.controlRowSpaced}>
        <div className={styles.controlRow}>
          <label className={styles.formLabel}>
            {t['com.affine.caseAssistant.settings.theme.mode.label']()}
            <select
              className={styles.input}
              value={props.themeMode}
              onChange={event => {
                props.onThemeModeChange(
                  event.target.value as 'system' | 'light' | 'dark'
                );
              }}
            >
              <option value="system">{t['com.affine.themeSettings.system']()}</option>
              <option value="light">{t['com.affine.themeSettings.light']()}</option>
              <option value="dark">{t['com.affine.themeSettings.dark']()}</option>
            </select>
          </label>
          <p className={localStyles.summaryTight}>
            <span className={styles.summary}>
              {t['com.affine.caseAssistant.settings.theme.description']()}
            </span>
          </p>
        </div>
      </div>

      {/* ── Data Residency ── */}
      <div className={localStyles.controlRowSpaced}>
        <div className={styles.controlRow}>
          <label className={styles.formLabel}>
            Data Residency Modus
            <select
              className={styles.input}
              value={props.residencyPolicyDraft.mode}
              disabled={!props.canAction('residency.manage')}
              onChange={event => {
                props.onResidencyPolicyDraftChange({
                  mode: event.target.value as WorkspaceResidencyMode,
                });
              }}
            >
              <option value="cloud">Cloud Sync</option>
              <option value="local_only">Local only</option>
              <option value="self_hosted">Self-hosted</option>
            </select>
          </label>

          <div className={localStyles.residencyToggleGrid}>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.allowCloudSync}
                disabled={
                  !props.canAction('residency.manage') ||
                  props.residencyPolicyDraft.mode === 'local_only'
                }
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    allowCloudSync: event.target.checked,
                  });
                }}
              />
              Cloud-Sync erlauben
            </label>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.allowRemoteOcr}
                disabled={
                  !props.canAction('residency.manage') ||
                  props.residencyPolicyDraft.mode === 'local_only'
                }
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    allowRemoteOcr: event.target.checked,
                  });
                }}
              />
              Remote OCR erlauben
            </label>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.allowExternalConnectors}
                disabled={
                  !props.canAction('residency.manage') ||
                  props.residencyPolicyDraft.mode === 'local_only'
                }
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    allowExternalConnectors: event.target.checked,
                  });
                }}
              />
              Externe Connectoren erlauben
            </label>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.allowTelemetry}
                disabled={!props.canAction('residency.manage')}
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    allowTelemetry: event.target.checked,
                  });
                }}
              />
              Telemetrie erlauben
            </label>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.requireMfaForAdmins}
                disabled={!props.canAction('residency.manage')}
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    requireMfaForAdmins: event.target.checked,
                  });
                }}
              />
              MFA für Admins erzwingen
            </label>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.requireMfaForMembers}
                disabled={!props.canAction('residency.manage')}
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    requireMfaForMembers: event.target.checked,
                  });
                }}
              />
              MFA für alle Mitglieder erzwingen
            </label>
            <label className={localStyles.residencyToggleLabel}>
              <input
                type="checkbox"
                checked={props.residencyPolicyDraft.enforceEncryptionAtRest}
                disabled={!props.canAction('residency.manage')}
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    enforceEncryptionAtRest: event.target.checked,
                  });
                }}
              />
              Verschlüsselung at Rest erzwingen
            </label>
            <label className={styles.formLabel}>
              Session-Timeout (Minuten)
              <input
                className={styles.input}
                type="number"
                min={5}
                max={240}
                value={props.residencyPolicyDraft.sessionIdleTimeoutMinutes}
                disabled={!props.canAction('residency.manage')}
                onChange={event => {
                  props.onResidencyPolicyDraftChange({
                    sessionIdleTimeoutMinutes: Number(event.target.value),
                  });
                }}
              />
            </label>
          </div>

          <div className={styles.quickActionRow}>
            <Button
              variant="secondary"
              disabled={!props.canAction('residency.manage')}
              onClick={() => {
                props.runAsyncUiAction(
                  props.onSaveResidencyPolicy,
                  'save residency policy failed'
                );
              }}
            >
              Residency speichern
            </Button>
          </div>
        </div>
      </div>

      {/* ── Connectoren ── */}
      <div className={styles.headerRow}>
        <div className={localStyles.connectorsHeaderRow}>
          <h4 className={localStyles.connectorsTitle}>
            {t['com.affine.caseAssistant.settings.connectors.title']()}
          </h4>
        </div>
        <span className={styles.chip}>
          {t.t('com.affine.caseAssistant.settings.connectors.configuredCount', {
            count: props.connectorCards.length,
          })}
        </span>
      </div>
      <p className={localStyles.connectorsIntro}>
        <span className={styles.summary}>
          {t['com.affine.caseAssistant.settings.connectors.description']()}
        </span>
      </p>

      {props.connectorCards.map(
        ({ connector, credentialMeta, rotationDays, rotationMode, rotationDue }) => (
          <div className={styles.connectorForm} key={connector.id}>
            <div className={styles.connectorLine}>
              <span className={styles.jobTitle}>{connector.name}</span>
              <span
                className={localStyles.connectorStatusChip}
                style={assignInlineVars({
                  [localStyles.connectorStatusBgVar]:
                    connector.status === 'connected'
                      ? cssVarV2('status/success')
                      : cssVarV2('status/error'),
                  [localStyles.connectorStatusFgVar]:
                    connector.status === 'connected'
                      ? cssVarV2('status/success')
                      : cssVarV2('status/error'),
                })}
              >
                {connector.status === 'connected'
                  ? t['com.affine.caseAssistant.settings.connectors.status.connected']()
                  : t['com.affine.caseAssistant.settings.connectors.status.disconnected']()}
              </span>
              <span className={styles.jobMeta}>
                {t['com.affine.caseAssistant.settings.connectors.auth.label']()}{' '}
                {credentialMeta.hasSecret
                  ? t['com.affine.caseAssistant.settings.connectors.auth.set']()
                  : t['com.affine.caseAssistant.settings.connectors.auth.empty']()}
              </span>
              <span className={styles.jobMeta}>
                {t['com.affine.caseAssistant.settings.connectors.lastUpdated']()}{' '}
                {props.formatSecretUpdatedAt(credentialMeta.updatedAt)}
              </span>
              {rotationDue ? (
                <span className={styles.warningText}>
                  {rotationMode === 'hard'
                    ? t.t(
                        'com.affine.caseAssistant.settings.connectors.rotation.dueHard',
                        { days: rotationDays }
                      )
                    : t.t(
                        'com.affine.caseAssistant.settings.connectors.rotation.dueSoft',
                        { days: rotationDays }
                      )}
                </span>
              ) : null}
            </div>

            <div className={styles.formGrid}>
              <label className={styles.formLabel}>
                {t['com.affine.caseAssistant.settings.connectors.endpoint']()}
                <input
                  className={styles.input}
                  value={props.connectorDrafts[connector.id]?.endpoint ?? ''}
                  onChange={event => {
                    props.onConnectorDraftChange(connector.id, {
                      endpoint: event.target.value,
                    });
                  }}
                  placeholder={t['com.affine.caseAssistant.settings.connectors.endpointPlaceholder']()}
                />
              </label>
              <label className={styles.formLabel}>
                {t['com.affine.caseAssistant.settings.connectors.authType']()}
                <select
                  className={styles.input}
                  value={props.connectorDrafts[connector.id]?.authType ?? 'none'}
                  onChange={event => {
                    const authType = event.target.value as ConnectorDraft['authType'];
                    props.onConnectorDraftChange(connector.id, { authType });
                  }}
                >
                  <option value="none">
                    {t['com.affine.caseAssistant.settings.connectors.authType.none']()}
                  </option>
                  <option value="bearer">
                    {t['com.affine.caseAssistant.settings.connectors.authType.bearer']()}
                  </option>
                  <option value="api-key">
                    {t['com.affine.caseAssistant.settings.connectors.authType.apiKey']()}
                  </option>
                </select>
              </label>
              {(props.connectorDrafts[connector.id]?.authType ?? 'none') === 'api-key' ? (
                <label className={styles.formLabel}>
                  {t['com.affine.caseAssistant.settings.connectors.headerName']()}
                  <input
                    className={styles.input}
                    value={props.connectorDrafts[connector.id]?.authHeaderName ?? ''}
                    onChange={event => {
                      props.onConnectorDraftChange(connector.id, {
                        authHeaderName: event.target.value,
                      });
                    }}
                    placeholder={t['com.affine.caseAssistant.settings.connectors.headerNamePlaceholder']()}
                  />
                </label>
              ) : null}
              <label className={styles.formLabel}>
                {t['com.affine.caseAssistant.settings.connectors.rotationDays']()}
                <input
                  className={styles.input}
                  type="number"
                  min={7}
                  max={365}
                  value={props.connectorDrafts[connector.id]?.rotationDays ?? '30'}
                  onChange={event => {
                    props.onConnectorDraftChange(connector.id, {
                      rotationDays: event.target.value,
                    });
                  }}
                />
              </label>
              <label className={styles.formLabel}>
                {t['com.affine.caseAssistant.settings.connectors.rotationMode']()}
                <select
                  className={styles.input}
                  value={props.connectorDrafts[connector.id]?.rotationMode ?? 'soft'}
                  onChange={event => {
                    props.onConnectorDraftChange(connector.id, {
                      rotationMode: props.normalizeRotationMode(event.target.value),
                    });
                  }}
                >
                  <option value="soft">
                    {t['com.affine.caseAssistant.settings.connectors.rotationMode.soft']()}
                  </option>
                  <option value="hard">
                    {t['com.affine.caseAssistant.settings.connectors.rotationMode.hard']()}
                  </option>
                </select>
              </label>
              <label className={styles.formLabel}>
                {t['com.affine.caseAssistant.settings.connectors.credential']()}
                <input
                  className={styles.input}
                  type="password"
                  value={props.connectorDrafts[connector.id]?.credential ?? ''}
                  onChange={event => {
                    props.onConnectorDraftChange(connector.id, {
                      credential: event.target.value,
                    });
                  }}
                  placeholder={t['com.affine.caseAssistant.settings.connectors.credentialPlaceholder']()}
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className={styles.formActions}>
              <Button
                variant="plain"
                disabled={!props.canAction('connector.rotate')}
                title={t['com.affine.caseAssistant.settings.connectors.action.rotate.title']()}
                onClick={() => {
                  props.runAsyncUiAction(
                    () => props.onRotateConnectorCredential(connector.id),
                    'rotate connector credential failed'
                  );
                }}
              >
                {t['com.affine.caseAssistant.settings.connectors.action.rotate.label']()}
              </Button>
              <Button
                variant="secondary"
                disabled={!props.canAction('connector.configure')}
                title={t['com.affine.caseAssistant.settings.connectors.action.save.title']()}
                onClick={() => {
                  props.runAsyncUiAction(
                    () => props.onSaveConnectorSettings(connector.id),
                    'save connector settings failed'
                  );
                }}
              >
                {t['com.affine.caseAssistant.settings.connectors.action.save.label']()}
              </Button>
              <Button
                variant="plain"
                disabled={!props.canAction('connector.toggle')}
                title={
                  connector.enabled
                    ? t['com.affine.caseAssistant.settings.connectors.action.disable.title']()
                    : t['com.affine.caseAssistant.settings.connectors.action.enable.title']()
                }
                onClick={() => {
                  props.runAsyncUiAction(
                    () => props.onToggleConnector(connector.id, !connector.enabled),
                    'connector toggle failed'
                  );
                }}
              >
                {connector.enabled
                  ? t['com.affine.caseAssistant.settings.connectors.action.disable.label']()
                  : t['com.affine.caseAssistant.settings.connectors.action.enable.label']()}
              </Button>
              <Button
                variant="plain"
                disabled={!props.canAction('connector.healthcheck')}
                title={t['com.affine.caseAssistant.settings.connectors.action.test.title']()}
                onClick={() => {
                  props.runAsyncUiAction(
                    () => props.onHealthcheckConnector(connector.id),
                    'connector healthcheck failed'
                  );
                }}
              >
                {t['com.affine.caseAssistant.settings.connectors.action.test.label']()}
              </Button>
              <Button
                variant="plain"
                disabled={!props.canAction('connector.clear_auth')}
                title={t['com.affine.caseAssistant.settings.connectors.action.clearAuth.title']()}
                onClick={() => {
                  props.runAsyncUiAction(
                    () => props.onClearConnectorCredential(connector.id),
                    'clear connector credential failed'
                  );
                }}
              >
                {t['com.affine.caseAssistant.settings.connectors.action.clearAuth.label']()}
              </Button>
            </div>
          </div>
        )
      )}

      {props.ingestionStatus ? (
        <p
          className={`${styles.status} ${
            props.statusTone === 'error' ? styles.statusError : styles.statusInfo
          }`}
          aria-live="polite"
          role="status"
        >
          {props.ingestionStatus}
        </p>
      ) : null}
    </section>
  );
});

EinstellungenSection.displayName = 'EinstellungenSection';
