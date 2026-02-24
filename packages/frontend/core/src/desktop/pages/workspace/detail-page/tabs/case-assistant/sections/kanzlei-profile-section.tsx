import { Button } from '@affine/component';
import type {
  AnwaltProfile,
  AnwaltRole,
  CaseAssistantAction,
  KanzleiProfile,
} from '@affine/core/modules/case-assistant';
import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import * as styles from '../../case-assistant.css';
import { anwaltRoleLabel } from '../panel-types';
import * as localStyles from './kanzlei-profile-section.css';

type KanzleiDraft = {
  name: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  steuernummer: string;
  ustIdNr: string;
  iban: string;
  bic: string;
  bankName: string;
  datevBeraternummer: string;
  datevMandantennummer: string;
  bmdFirmennummer: string;
  rechtsanwaltskammer: string;
  aktenzeichenSchema: string;
};

type AnwaltDraft = {
  id: string;
  workspaceUserId: string;
  workspaceUserEmail: string;
  title: string;
  firstName: string;
  lastName: string;
  fachgebiet: string;
  email: string;
  phone: string;
  zulassungsnummer: string;
  role: AnwaltRole;
};

const EMPTY_KANZLEI_DRAFT: KanzleiDraft = {
  name: '',
  address: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  steuernummer: '',
  ustIdNr: '',
  iban: '',
  bic: '',
  bankName: '',
  datevBeraternummer: '',
  datevMandantennummer: '',
  bmdFirmennummer: '',
  rechtsanwaltskammer: '',
  aktenzeichenSchema: '',
};

const EMPTY_ANWALT_DRAFT: AnwaltDraft = {
  id: '',
  workspaceUserId: '',
  workspaceUserEmail: '',
  title: 'RA',
  firstName: '',
  lastName: '',
  fachgebiet: '',
  email: '',
  phone: '',
  zulassungsnummer: '',
  role: 'associate',
};

function kanzleiToDraft(profile: KanzleiProfile | null): KanzleiDraft {
  if (!profile) {
    return { ...EMPTY_KANZLEI_DRAFT };
  }
  return {
    name: profile.name,
    address: profile.address ?? '',
    phone: profile.phone ?? '',
    fax: profile.fax ?? '',
    email: profile.email ?? '',
    website: profile.website ?? '',
    steuernummer: profile.steuernummer ?? '',
    ustIdNr: profile.ustIdNr ?? '',
    iban: profile.iban ?? '',
    bic: profile.bic ?? '',
    bankName: profile.bankName ?? '',
    datevBeraternummer: profile.datevBeraternummer ?? '',
    datevMandantennummer: profile.datevMandantennummer ?? '',
    bmdFirmennummer: profile.bmdFirmennummer ?? '',
    rechtsanwaltskammer: profile.rechtsanwaltskammer ?? '',
    aktenzeichenSchema: profile.aktenzeichenSchema ?? '',
  };
}

function anwaltToDraft(anwalt: AnwaltProfile): AnwaltDraft {
  return {
    id: anwalt.id,
    workspaceUserId: anwalt.workspaceUserId ?? '',
    workspaceUserEmail: anwalt.workspaceUserEmail ?? '',
    title: anwalt.title,
    firstName: anwalt.firstName,
    lastName: anwalt.lastName,
    fachgebiet: anwalt.fachgebiet ?? '',
    email: anwalt.email ?? '',
    phone: anwalt.phone ?? '',
    zulassungsnummer: anwalt.zulassungsnummer ?? '',
    role: anwalt.role,
  };
}

type Props = {
  sectionRef: RefObject<HTMLElement | null>;
  kanzleiProfile: KanzleiProfile | null;
  anwaelte: AnwaltProfile[];
  linkedWorkspaceUsers: Array<{ id: string; email: string; name?: string | null }>;
  canAction: (action: CaseAssistantAction) => boolean;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  onSaveKanzleiProfile: (draft: KanzleiDraft & { logoDataUrl?: string }) => void | Promise<unknown>;
  onSaveAnwalt: (draft: AnwaltDraft) => void | Promise<unknown>;
  onDeactivateAnwalt: (anwaltId: string) => void | Promise<unknown>;
};

const TITLE_OPTIONS = ['RA', 'RAin', 'Dr.', 'Dr. jur.', 'Prof. Dr.', 'Mag.', 'Mag. jur.', 'MMag.'];
const ROLE_OPTIONS: AnwaltRole[] = ['partner', 'senior_associate', 'associate', 'counsel', 'referendar', 'other'];

export const KanzleiProfileSection = memo((props: Props) => {
  const [kanzleiDraft, setKanzleiDraft] = useState<KanzleiDraft>(() =>
    kanzleiToDraft(props.kanzleiProfile)
  );
  const [isKanzleiEditing, setIsKanzleiEditing] = useState(false);
  const [anwaltDraft, setAnwaltDraft] = useState<AnwaltDraft>({ ...EMPTY_ANWALT_DRAFT });
  const [anwaltFormError, setAnwaltFormError] = useState<string | null>(null);
  const [isAnwaltFormOpen, setIsAnwaltFormOpen] = useState(false);
  const [expandedAnwaltId, setExpandedAnwaltId] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(props.kanzleiProfile?.logoDataUrl ?? null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const onLogoFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 512 * 1024) {
      alert('Logo darf maximal 512 KB groß sein.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const onRemoveLogo = useCallback(() => {
    setLogoPreview(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    if (!isKanzleiEditing) {
      setKanzleiDraft(kanzleiToDraft(props.kanzleiProfile));
      setLogoPreview(props.kanzleiProfile?.logoDataUrl ?? null);
    }
  }, [props.kanzleiProfile, isKanzleiEditing]);

  const canManage = props.canAction('kanzlei.manage');
  const hasProfile = !!props.kanzleiProfile;
  const activeAnwaelte = props.anwaelte.filter(a => a.isActive);
  const inactiveAnwaelte = props.anwaelte.filter(a => !a.isActive);

  const onKanzleiFieldChange = (field: keyof KanzleiDraft, value: string) => {
    setKanzleiDraft(prev => ({ ...prev, [field]: value }));
  };

  const onAnwaltFieldChange = (field: keyof AnwaltDraft, value: string) => {
    setAnwaltFormError(null);
    setAnwaltDraft(prev => ({ ...prev, [field]: value }));
  };

  const onLinkedWorkspaceUserChange = (value: string) => {
    if (!value) {
      onAnwaltFieldChange('workspaceUserId', '');
      onAnwaltFieldChange('workspaceUserEmail', '');
      return;
    }

    const selected = props.linkedWorkspaceUsers.find(user => user.id === value);
    if (!selected) {
      return;
    }

    setAnwaltFormError(null);
    setAnwaltDraft(prev => ({
      ...prev,
      workspaceUserId: selected.id,
      workspaceUserEmail: selected.email,
      email: prev.email || selected.email,
    }));
  };

  const onSaveKanzlei = () => {
    if (!kanzleiDraft.name.trim()) {
      return;
    }
    props.runAsyncUiAction(async () => {
      await props.onSaveKanzleiProfile({ ...kanzleiDraft, logoDataUrl: logoPreview ?? undefined });
      setIsKanzleiEditing(false);
    }, 'Kanzleiprofil speichern');
  };

  const onSaveAnwalt = () => {
    if (!anwaltDraft.firstName.trim() || !anwaltDraft.lastName.trim()) {
      return;
    }

    const workspaceUserId = anwaltDraft.workspaceUserId.trim();
    const workspaceUserEmail = anwaltDraft.workspaceUserEmail.trim().toLowerCase();
    const hasLinkedUser = workspaceUserId.length > 0 || workspaceUserEmail.length > 0;

    if (hasLinkedUser && (!workspaceUserId || !workspaceUserEmail)) {
      setAnwaltFormError('Für die Kontokopplung bitte sowohl Workspace-User-ID als auch E-Mail angeben.');
      return;
    }

    if (workspaceUserEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workspaceUserEmail)) {
      setAnwaltFormError('Die verknüpfte Workspace-E-Mail ist ungültig.');
      return;
    }

    if (workspaceUserId) {
      const linkedUser = props.linkedWorkspaceUsers.find(user => user.id === workspaceUserId);
      if (!linkedUser) {
        setAnwaltFormError('Das angegebene Workspace-Konto ist in diesem Workspace nicht als Mitglied vorhanden.');
        return;
      }
      if (workspaceUserEmail !== linkedUser.email.toLowerCase()) {
        setAnwaltFormError('Workspace-User-ID und Workspace-E-Mail passen nicht zusammen.');
        return;
      }
    }

    if (
      workspaceUserId &&
      props.anwaelte.some(
        anwalt =>
          anwalt.isActive &&
          anwalt.id !== anwaltDraft.id &&
          anwalt.workspaceUserId === workspaceUserId
      )
    ) {
      setAnwaltFormError('Dieses Workspace-Konto ist bereits einem aktiven Anwalt zugeordnet.');
      return;
    }

    props.runAsyncUiAction(async () => {
      await props.onSaveAnwalt({
        ...anwaltDraft,
        workspaceUserId,
        workspaceUserEmail,
      });
      setAnwaltDraft({ ...EMPTY_ANWALT_DRAFT });
      setAnwaltFormError(null);
      setIsAnwaltFormOpen(false);
    }, 'Anwalt speichern');
  };

  const onEditAnwalt = (anwalt: AnwaltProfile) => {
    setAnwaltDraft(anwaltToDraft(anwalt));
    setIsAnwaltFormOpen(true);
  };

  const onDeactivate = (anwaltId: string) => {
    props.runAsyncUiAction(
      () => props.onDeactivateAnwalt(anwaltId),
      'Anwalt deaktivieren'
    );
  };

  return (
    <section ref={props.sectionRef} className={styles.section}>
      <div className={styles.headerRow}>
        <h3 className={styles.sectionTitle}>Kanzleiprofil</h3>
        {hasProfile ? (
          <span className={styles.chip}>
            {activeAnwaelte.length} Anwält{activeAnwaelte.length !== 1 ? 'e' : ''}
          </span>
        ) : (
          <span className={`${styles.chip} ${localStyles.chipNotSetup}`}>Nicht eingerichtet</span>
        )}
      </div>

      {/* ═══ Kanzlei-Stammdaten ═══ */}
      <details open={!hasProfile || isKanzleiEditing}>
        <summary className={`${styles.sectionTitle} ${localStyles.interactiveSummary}`}>
          Kanzlei-Stammdaten
        </summary>

        {!hasProfile && !isKanzleiEditing ? (
          <div className={styles.empty}>
            Noch kein Kanzleiprofil angelegt. Bitte Stammdaten eingeben.
            {canManage ? (
              <div className={localStyles.emptyCtaRow}>
                <Button variant="primary" onClick={() => setIsKanzleiEditing(true)}>
                  Kanzleiprofil anlegen
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasProfile && !isKanzleiEditing ? (
          <div className={localStyles.profileStack}>
            {props.kanzleiProfile!.logoDataUrl ? (
              <div className={localStyles.logoBlock}>
                <img
                  src={props.kanzleiProfile!.logoDataUrl}
                  alt={`Logo ${props.kanzleiProfile!.name}`}
                  className={localStyles.logoImg}
                />
              </div>
            ) : null}
            <div className={localStyles.profileName}>{props.kanzleiProfile!.name}</div>
            {props.kanzleiProfile!.address ? (
              <div className={styles.jobMeta}>{props.kanzleiProfile!.address}</div>
            ) : null}
            <div className={`${styles.jobMeta} ${localStyles.metaWrapRow}`}>
              {props.kanzleiProfile!.phone ? <span>Tel.: {props.kanzleiProfile!.phone}</span> : null}
              {props.kanzleiProfile!.fax ? <span>Fax: {props.kanzleiProfile!.fax}</span> : null}
              {props.kanzleiProfile!.email ? <span>E-Mail: {props.kanzleiProfile!.email}</span> : null}
            </div>
            {props.kanzleiProfile!.website ? (
              <div className={styles.jobMeta}>{props.kanzleiProfile!.website}</div>
            ) : null}
            <div className={`${styles.jobMeta} ${localStyles.metaWrapRow}`}>
              {props.kanzleiProfile!.steuernummer ? <span>St.-Nr.: {props.kanzleiProfile!.steuernummer}</span> : null}
              {props.kanzleiProfile!.ustIdNr ? <span>USt-IdNr.: {props.kanzleiProfile!.ustIdNr}</span> : null}
            </div>
            {props.kanzleiProfile!.iban ? (
              <div className={styles.jobMeta}>
                IBAN: {props.kanzleiProfile!.iban}
                {props.kanzleiProfile!.bic ? ` | BIC: ${props.kanzleiProfile!.bic}` : ''}
                {props.kanzleiProfile!.bankName ? ` | ${props.kanzleiProfile!.bankName}` : ''}
              </div>
            ) : null}
            {props.kanzleiProfile!.rechtsanwaltskammer ? (
              <div className={styles.jobMeta}>RAK: {props.kanzleiProfile!.rechtsanwaltskammer}</div>
            ) : null}
            {props.kanzleiProfile!.aktenzeichenSchema ? (
              <div className={styles.jobMeta}>AZ-Schema: {props.kanzleiProfile!.aktenzeichenSchema}</div>
            ) : null}
            <div className={`${styles.jobMeta} ${localStyles.metaWrapRow}`}>
              <span>
                DATEV Beraternr.: {props.kanzleiProfile!.datevBeraternummer?.trim() || 'fehlt'}
              </span>
              <span>
                DATEV Mandantennr.: {props.kanzleiProfile!.datevMandantennummer?.trim() || 'fehlt'}
              </span>
              <span>
                BMD Firmennr.: {props.kanzleiProfile!.bmdFirmennummer?.trim() || 'fehlt'}
              </span>
            </div>
            {canManage ? (
              <div className={styles.formActions}>
                <Button variant="plain" onClick={() => {
                  setKanzleiDraft(kanzleiToDraft(props.kanzleiProfile));
                  setIsKanzleiEditing(true);
                }}>
                  Bearbeiten
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {isKanzleiEditing ? (
          <div className={styles.connectorForm}>
            <div className={styles.formGrid}>
              <label className={styles.formLabel}>
                Kanzleiname *
                <input
                  className={styles.input}
                  value={kanzleiDraft.name}
                  onChange={e => onKanzleiFieldChange('name', e.target.value)}
                  placeholder="z. B. Musterkanzlei & Partner"
                  required
                  aria-required="true"
                />
              </label>
              <div className={styles.formLabel}>
                Kanzlei-Logo
                <div className={localStyles.logoRow}>
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo-Vorschau"
                      className={localStyles.logoPreviewImg}
                    />
                  ) : (
                    <div className={localStyles.logoPlaceholder}>
                      Kein Logo
                    </div>
                  )}
                  <div className={localStyles.logoButtonCol}>
                    <Button variant="plain" className={localStyles.logoButtonSmall} onClick={() => logoInputRef.current?.click()}>
                      {logoPreview ? 'Logo ändern' : 'Logo hochladen'}
                    </Button>
                    {logoPreview ? (
                      <Button
                        variant="plain"
                        className={`${localStyles.logoButtonSmall} ${localStyles.dangerPlainButton}`}
                        onClick={onRemoveLogo}
                      >
                        Logo entfernen
                      </Button>
                    ) : null}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className={localStyles.hiddenFileInput}
                    onChange={onLogoFileChange}
                  />
                </div>
                <span className={localStyles.logoHint}>
                  PNG, JPG, SVG oder WebP · max. 512 KB
                </span>
              </div>
              <label className={styles.formLabel}>
                Adresse
                <textarea
                  className={styles.input}
                  value={kanzleiDraft.address}
                  onChange={e => onKanzleiFieldChange('address', e.target.value)}
                  placeholder="Musterstraße 1&#10;1010 Wien"
                  rows={2}
                />
              </label>
              <label className={styles.formLabel}>
                Telefon
                <input
                  className={styles.input}
                  value={kanzleiDraft.phone}
                  onChange={e => onKanzleiFieldChange('phone', e.target.value)}
                  placeholder="+43 1 12345"
                  type="tel"
                />
              </label>
              <label className={styles.formLabel}>
                Fax
                <input
                  className={styles.input}
                  value={kanzleiDraft.fax}
                  onChange={e => onKanzleiFieldChange('fax', e.target.value)}
                  placeholder="+43 1 12345-99"
                  type="tel"
                />
              </label>
              <label className={styles.formLabel}>
                E-Mail
                <input
                  className={styles.input}
                  value={kanzleiDraft.email}
                  onChange={e => onKanzleiFieldChange('email', e.target.value)}
                  placeholder="office@kanzlei.at"
                  type="email"
                />
              </label>
              <label className={styles.formLabel}>
                Website
                <input
                  className={styles.input}
                  value={kanzleiDraft.website}
                  onChange={e => onKanzleiFieldChange('website', e.target.value)}
                  placeholder="https://www.kanzlei.at"
                  type="url"
                />
              </label>
            </div>

            <details>
              <summary className={`${styles.sectionTitle} ${localStyles.interactiveSummarySmall}`}>
                Steuer- und Bankdaten
              </summary>
              <div className={`${styles.formGrid} ${localStyles.detailsContentTop}`}>
                <label className={styles.formLabel}>
                  Steuernummer
                  <input
                    className={styles.input}
                    value={kanzleiDraft.steuernummer}
                    onChange={e => onKanzleiFieldChange('steuernummer', e.target.value)}
                    placeholder="z. B. 09 123/4567"
                  />
                </label>
                <label className={styles.formLabel}>
                  USt-IdNr.
                  <input
                    className={styles.input}
                    value={kanzleiDraft.ustIdNr}
                    onChange={e => onKanzleiFieldChange('ustIdNr', e.target.value)}
                    placeholder="z. B. ATU12345678"
                  />
                </label>
                <label className={styles.formLabel}>
                  IBAN
                  <input
                    className={styles.input}
                    value={kanzleiDraft.iban}
                    onChange={e => onKanzleiFieldChange('iban', e.target.value)}
                    placeholder="AT12 3456 7890 1234 5678"
                  />
                </label>
                <label className={styles.formLabel}>
                  BIC
                  <input
                    className={styles.input}
                    value={kanzleiDraft.bic}
                    onChange={e => onKanzleiFieldChange('bic', e.target.value)}
                    placeholder="z. B. BKAUATWW"
                  />
                </label>
                <label className={styles.formLabel}>
                  Bankname
                  <input
                    className={styles.input}
                    value={kanzleiDraft.bankName}
                    onChange={e => onKanzleiFieldChange('bankName', e.target.value)}
                    placeholder="z. B. UniCredit Bank Austria"
                  />
                </label>
                <label className={styles.formLabel}>
                  DATEV Beraternummer
                  <input
                    className={styles.input}
                    value={kanzleiDraft.datevBeraternummer}
                    onChange={e => onKanzleiFieldChange('datevBeraternummer', e.target.value)}
                    placeholder="z. B. 12345"
                  />
                </label>
                <label className={styles.formLabel}>
                  DATEV Mandantennummer
                  <input
                    className={styles.input}
                    value={kanzleiDraft.datevMandantennummer}
                    onChange={e => onKanzleiFieldChange('datevMandantennummer', e.target.value)}
                    placeholder="z. B. 67890"
                  />
                </label>
                <label className={styles.formLabel}>
                  BMD Firmennummer
                  <input
                    className={styles.input}
                    value={kanzleiDraft.bmdFirmennummer}
                    onChange={e => onKanzleiFieldChange('bmdFirmennummer', e.target.value)}
                    placeholder="z. B. AT-1001"
                  />
                </label>
              </div>
            </details>

            <details>
              <summary className={`${styles.sectionTitle} ${localStyles.interactiveSummarySmall}`}>
                Kammer und Aktenzeichen
              </summary>
              <div className={`${styles.formGrid} ${localStyles.detailsContentTop}`}>
                <label className={styles.formLabel}>
                  Rechtsanwaltskammer
                  <input
                    className={styles.input}
                    value={kanzleiDraft.rechtsanwaltskammer}
                    onChange={e => onKanzleiFieldChange('rechtsanwaltskammer', e.target.value)}
                    placeholder="z. B. RAK Wien"
                  />
                </label>
                <label className={styles.formLabel}>
                  Aktenzeichen-Schema
                  <input
                    className={styles.input}
                    value={kanzleiDraft.aktenzeichenSchema}
                    onChange={e => onKanzleiFieldChange('aktenzeichenSchema', e.target.value)}
                    placeholder="z. B. {year}/{seq} oder {client}/{year}-{seq}"
                  />
                </label>
              </div>
            </details>

            <div className={styles.formActions}>
              <Button variant="plain" onClick={() => {
                setKanzleiDraft(kanzleiToDraft(props.kanzleiProfile));
                setIsKanzleiEditing(false);
              }}>
                Abbrechen
              </Button>
              <Button
                variant="primary"
                disabled={!kanzleiDraft.name.trim()}
                onClick={onSaveKanzlei}
              >
                Kanzleiprofil speichern
              </Button>
            </div>
          </div>
        ) : null}
      </details>

      {/* ═══ Anwälte / Team ═══ */}
      <details open>
        <summary className={`${styles.sectionTitle} ${localStyles.interactiveSummary}`}>
          Anwälte / Team ({activeAnwaelte.length} aktiv)
        </summary>

        {activeAnwaelte.length === 0 && !isAnwaltFormOpen ? (
          <div className={styles.empty}>
            Noch keine Anwälte angelegt.
            {canManage ? ' Legen Sie den ersten Anwalt (Bearbeiter) an.' : ''}
          </div>
        ) : null}

        {activeAnwaelte.length > 0 ? (
          <ul className={styles.documentList} aria-label="Anwälteverzeichnis">
            {activeAnwaelte.map(anwalt => {
              const isExpanded = expandedAnwaltId === anwalt.id;
              return (
                <li key={anwalt.id} className={styles.documentItem}>
                  <button
                    type="button"
                    className={localStyles.anwaltToggleButton}
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedAnwaltId(isExpanded ? null : anwalt.id)}
                  >
                    <span className={localStyles.anwaltIcon}></span>
                    <span className={localStyles.anwaltName}>
                      {anwalt.title} {anwalt.firstName} {anwalt.lastName}
                    </span>
                    <span className={`${styles.chip} ${localStyles.anwaltRoleChipSmall}`}>
                      {anwaltRoleLabel[anwalt.role]}
                    </span>
                    <span className={localStyles.collapseArrow}>
                      {isExpanded ? 'Schließen' : 'Öffnen'}
                    </span>
                  </button>

                  {anwalt.fachgebiet ? (
                    <div className={styles.documentMeta}>
                      <span>{anwalt.fachgebiet}</span>
                    </div>
                  ) : null}

                  {isExpanded ? (
                    <div className={localStyles.anwaltDetails}>
                      {anwalt.workspaceUserEmail ? (
                        <div className={styles.jobMeta}>
                          Workspace-Konto: {anwalt.workspaceUserEmail}
                          {anwalt.workspaceUserId ? ` · ${anwalt.workspaceUserId}` : ''}
                        </div>
                      ) : null}
                      {anwalt.email ? (
                        <div className={styles.jobMeta}>E-Mail: {anwalt.email}</div>
                      ) : null}
                      {anwalt.phone ? (
                        <div className={styles.jobMeta}>Tel.: {anwalt.phone}</div>
                      ) : null}
                      {anwalt.zulassungsnummer ? (
                        <div className={styles.jobMeta}>Zul.-Nr.: {anwalt.zulassungsnummer}</div>
                      ) : null}
                      {canManage ? (
                        <div className={`${styles.formActions} ${localStyles.formActionsTop}`}>
                          <Button variant="plain" onClick={() => onEditAnwalt(anwalt)}>
                            Bearbeiten
                          </Button>
                          <Button
                            variant="plain"
                            className={localStyles.dangerPlainButton}
                            onClick={() => onDeactivate(anwalt.id)}
                          >
                            Deaktivieren
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {inactiveAnwaelte.length > 0 ? (
          <details className={localStyles.detailsContentTop}>
            <summary className={`${styles.jobMeta} ${localStyles.interactiveSummary}`}> 
              {inactiveAnwaelte.length} inaktive Anwält{inactiveAnwaelte.length !== 1 ? 'e' : ''}
            </summary>
            <ul className={styles.documentList}>
              {inactiveAnwaelte.map(anwalt => (
                <li key={anwalt.id} className={styles.documentItem}>
                  <div className={styles.documentTitle}>
                    {anwalt.title} {anwalt.firstName} {anwalt.lastName}
                    <span className={`${styles.chip} ${localStyles.anwaltRoleChipSmall}`}>inaktiv</span>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {canManage && !isAnwaltFormOpen ? (
          <div className={`${styles.formActions} ${localStyles.detailsContentTop}`}>
            <Button variant="primary" onClick={() => {
              setAnwaltDraft({ ...EMPTY_ANWALT_DRAFT });
              setIsAnwaltFormOpen(true);
            }}>
              Anwalt hinzufügen
            </Button>
          </div>
        ) : null}

        {isAnwaltFormOpen ? (
          <div className={`${styles.connectorForm} ${localStyles.emptyCtaRow}`}>
            <div className={localStyles.profileName}>
              {anwaltDraft.id ? 'Anwalt bearbeiten' : 'Neuen Anwalt anlegen'}
            </div>
            <div className={styles.formGrid}>
              <label className={styles.formLabel}>
                Workspace-Mitglied auswählen
                <select
                  className={styles.input}
                  value={anwaltDraft.workspaceUserId}
                  onChange={e => onLinkedWorkspaceUserChange(e.target.value)}
                >
                  <option value="">Nicht verknüpft</option>
                  {props.linkedWorkspaceUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name ? `${user.name} · ${user.email}` : user.email}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.formLabel}>
                Verknüpfter Workspace-User (ID)
                <input
                  className={styles.input}
                  value={anwaltDraft.workspaceUserId}
                  onChange={e => onAnwaltFieldChange('workspaceUserId', e.target.value)}
                  placeholder="user_..."
                />
              </label>
              <label className={styles.formLabel}>
                Verknüpfte Workspace-E-Mail
                <input
                  className={styles.input}
                  value={anwaltDraft.workspaceUserEmail}
                  onChange={e => onAnwaltFieldChange('workspaceUserEmail', e.target.value)}
                  placeholder="kanzlei.user@domain.tld"
                  type="email"
                />
              </label>
              <label className={styles.formLabel}>
                Titel / Anrede
                <select
                  className={styles.input}
                  value={anwaltDraft.title}
                  onChange={e => onAnwaltFieldChange('title', e.target.value)}
                >
                  {TITLE_OPTIONS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formLabel}>
                Vorname *
                <input
                  className={styles.input}
                  value={anwaltDraft.firstName}
                  onChange={e => onAnwaltFieldChange('firstName', e.target.value)}
                  placeholder="Max"
                  required
                  aria-required="true"
                />
              </label>
              <label className={styles.formLabel}>
                Nachname *
                <input
                  className={styles.input}
                  value={anwaltDraft.lastName}
                  onChange={e => onAnwaltFieldChange('lastName', e.target.value)}
                  placeholder="Mustermann"
                  required
                  aria-required="true"
                />
              </label>
              <label className={styles.formLabel}>
                Rolle
                <select
                  className={styles.input}
                  value={anwaltDraft.role}
                  onChange={e => onAnwaltFieldChange('role', e.target.value)}
                >
                  {ROLE_OPTIONS.map(r => (
                    <option key={r} value={r}>{anwaltRoleLabel[r]}</option>
                  ))}
                </select>
              </label>
              <label className={styles.formLabel}>
                Fachgebiet
                <input
                  className={styles.input}
                  value={anwaltDraft.fachgebiet}
                  onChange={e => onAnwaltFieldChange('fachgebiet', e.target.value)}
                  placeholder="z. B. Fachanwalt für Arbeitsrecht"
                />
              </label>
              <label className={styles.formLabel}>
                E-Mail
                <input
                  className={styles.input}
                  value={anwaltDraft.email}
                  onChange={e => onAnwaltFieldChange('email', e.target.value)}
                  placeholder="max.mustermann@kanzlei.at"
                  type="email"
                />
              </label>
              <label className={styles.formLabel}>
                Telefon (Durchwahl)
                <input
                  className={styles.input}
                  value={anwaltDraft.phone}
                  onChange={e => onAnwaltFieldChange('phone', e.target.value)}
                  placeholder="+43 1 12345-12"
                  type="tel"
                />
              </label>
              <label className={styles.formLabel}>
                Zulassungsnummer
                <input
                  className={styles.input}
                  value={anwaltDraft.zulassungsnummer}
                  onChange={e => onAnwaltFieldChange('zulassungsnummer', e.target.value)}
                  placeholder="z. B. W-12345"
                />
              </label>
            </div>
            {anwaltFormError ? <div className={styles.empty}>{anwaltFormError}</div> : null}
            <div className={styles.formActions}>
              <Button variant="plain" onClick={() => {
                setAnwaltDraft({ ...EMPTY_ANWALT_DRAFT });
                setAnwaltFormError(null);
                setIsAnwaltFormOpen(false);
              }}>
                Abbrechen
              </Button>
              <Button
                variant="primary"
                disabled={!anwaltDraft.firstName.trim() || !anwaltDraft.lastName.trim()}
                onClick={onSaveAnwalt}
              >
                {anwaltDraft.id ? 'Änderungen speichern' : 'Anwalt anlegen'}
              </Button>
            </div>
          </div>
        ) : null}
      </details>
    </section>
  );
});

KanzleiProfileSection.displayName = 'KanzleiProfileSection';
