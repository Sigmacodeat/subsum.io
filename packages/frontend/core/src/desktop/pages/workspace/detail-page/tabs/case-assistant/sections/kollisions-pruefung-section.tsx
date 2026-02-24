import { useCallback, useState } from 'react';

import type { KollisionsCheckResult, KollisionsTreffer } from '@affine/core/modules/case-assistant';
import { KollisionsPruefungService } from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { useService } from '@toeverything/infra';

import * as localStyles from './kollisions-pruefung-section.css';

const MATCH_LEVEL_LABEL: Record<string, string> = {
  exact: 'Exakt',
  high: 'Hoch',
  medium: 'Mittel',
  low: 'Niedrig',
};

const MATCH_LEVEL_COLOR: Record<string, string> = {
  exact: cssVarV2('status/error'),
  high: cssVarV2('text/primary'),
  medium: cssVarV2('text/secondary'),
  low: cssVarV2('status/success'),
};

const ROLLE_LABEL: Record<string, string> = {
  mandant: 'Mandant',
  gegner: 'Gegner',
  beteiligter: 'Beteiligter',
  anwalt: 'Anwalt',
  zeuge: 'Zeuge',
  mitarbeiter: 'Mitarbeiter',
};

function TrefferCard({
  treffer,
  onIgnore,
}: {
  treffer: KollisionsTreffer;
  onIgnore: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = MATCH_LEVEL_COLOR[treffer.matchLevel] ?? cssVarV2('text/secondary');
  const isHighRisk = treffer.matchLevel === 'exact' || treffer.matchLevel === 'high';

  return (
    <div
      className={localStyles.trefferCard}
      style={assignInlineVars({
        [localStyles.borderVar]: isHighRisk ? color : cssVarV2('layer/insideBorder/border'),
        [localStyles.surfaceVar]: cssVarV2('layer/background/primary'),
      })}
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className={localStyles.trefferHeaderButton}
        aria-expanded={expanded}
      >
        <span
          className={localStyles.trefferDot}
          style={assignInlineVars({ [localStyles.accentColorVar]: color })}
        />
        <span className={localStyles.trefferName}>
          {treffer.matchedName}
        </span>
        <span
          className={localStyles.levelBadge}
          style={assignInlineVars({ [localStyles.accentColorVar]: color })}
        >
          {MATCH_LEVEL_LABEL[treffer.matchLevel]}
        </span>
        <span className={localStyles.rolleBadge}>
          {ROLLE_LABEL[treffer.matchedRolle] ?? treffer.matchedRolle}
        </span>
        <span className={localStyles.caret}>
          {expanded ? 'Schließen' : 'Öffnen'}
        </span>
      </button>

      {expanded && (
        <div className={localStyles.trefferBody}>
          {treffer.relatedMatterName && (
            <div className={localStyles.trefferMeta}>
              <span className={localStyles.trefferMetaMuted}>Akte: </span>
              <strong>{treffer.relatedMatterName}</strong>
            </div>
          )}
          <div className={localStyles.trefferMeta}>
            <span className={localStyles.trefferMetaMuted}>Übereinstimmungs-Score: </span>
            <strong>{treffer.score}%</strong>
          </div>
          {isHighRisk && (
            <div className={localStyles.collisionWarning}>
              <strong>Mögliche Interessenkollision!</strong> Diese Person/Firma ist bereits in einer anderen Akte
              als <strong>{ROLLE_LABEL[treffer.matchedRolle]}</strong> erfasst. Bitte prüfen Sie, ob eine Kollision
              gem. § 43a BRAO / § 9 RAO vorliegt.
            </div>
          )}
          <button
            type="button"
            onClick={() => onIgnore(treffer.id)}
            className={localStyles.ignoreButton}
          >
            Als unbedenklich markieren
          </button>
        </div>
      )}
    </div>
  );
}

export function KollisionsPruefungSection({
  workspaceId,
  caseId,
  matterId,
  anwaltId,
  sectionRef,
}: {
  workspaceId: string;
  caseId: string;
  matterId?: string;
  anwaltId?: string;
  sectionRef?: React.RefObject<HTMLElement | null>;
}) {
  const kollisionsService = useService(KollisionsPruefungService);

  const [query, setQuery] = useState('');
  const [result, setResult] = useState<KollisionsCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideLogged, setOverrideLogged] = useState(false);

  const handleCheck = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    setIgnoredIds(new Set());
    setOverrideMode(false);
    setOverrideLogged(false);
    try {
      const res = await kollisionsService.checkKollision(query.trim(), matterId);
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  }, [query, matterId, kollisionsService]);

  const handleIgnore = useCallback((id: string) => {
    setIgnoredIds(prev => new Set([...prev, id]));
  }, []);

  const handleOverride = useCallback(async () => {
    if (!result || !overrideReason.trim()) return;
    await kollisionsService.logKollisionsCheck(
      workspaceId,
      caseId,
      anwaltId ?? 'unknown',
      result,
      true,
      overrideReason,
      matterId
    );
    setOverrideLogged(true);
  }, [result, overrideReason, kollisionsService, workspaceId, caseId, anwaltId, matterId]);

  const visibleTreffer = result?.treffer.filter(t => !ignoredIds.has(t.id)) ?? [];
  const criticalCount = visibleTreffer.filter(
    t => t.matchLevel === 'exact' || t.matchLevel === 'high'
  ).length;

  return (
    <section
      ref={sectionRef as React.RefObject<HTMLElement>}
      className={localStyles.root}
    >
      {/* Header */}
      <div className={localStyles.header}>
        <span className={localStyles.headerIcon}></span>
        <div>
          <div className={localStyles.headerTitle}>Kollisionsprüfung</div>
          <div className={localStyles.headerSubtitle}>
            § 43a BRAO / § 9 BORA (DE) · § 9 RAO (AT) — Interessenkonflikt-Check
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className={localStyles.searchRow}>
        <input
          id="kollision-query"
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void handleCheck()}
          placeholder="Name, Firma oder Adresse eingeben…"
          aria-label="Suchbegriff für Kollisionsprüfung"
          className={localStyles.searchInput}
        />
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={isLoading || !query.trim()}
          className={localStyles.searchButton}
          style={assignInlineVars({
            [localStyles.surfaceVar]: isLoading || !query.trim() ? cssVarV2('layer/background/secondary') : cssVarV2('button/primary'),
            [localStyles.accentColorVar]: isLoading || !query.trim() ? cssVarV2('text/secondary') : cssVarV2('button/pureWhiteText'),
            [localStyles.opacityVar]: isLoading || !query.trim() ? '0.7' : '1',
          })}
        >
          {isLoading ? 'Prüfe…' : 'Prüfen'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div>
          {/* Status Banner */}
          <div
            className={localStyles.statusBanner}
            style={assignInlineVars({
              [localStyles.surfaceVar]: cssVarV2('layer/background/secondary'),
              [localStyles.borderVar]: criticalCount > 0 ? cssVarV2('status/error') : cssVarV2('status/success'),
            })}
          >
            <span className={localStyles.statusBannerIcon}>{criticalCount > 0 ? 'Warnung' : 'OK'}</span>
            <div>
              <div
                className={localStyles.statusBannerTitle}
                style={assignInlineVars({
                  [localStyles.accentColorVar]: criticalCount > 0 ? cssVarV2('status/error') : cssVarV2('status/success'),
                })}
              >
                {criticalCount > 0
                  ? `${criticalCount} kritische Kollision${criticalCount > 1 ? 'en' : ''} gefunden`
                  : visibleTreffer.length > 0
                    ? `${visibleTreffer.length} Treffer (niedrige Relevanz)`
                    : 'Keine Kollisionen gefunden — Mandat kann angenommen werden'}
              </div>
              <div className={localStyles.statusBannerMeta}>
                Geprüft: „{result.query}" · {new Date(result.timestamp).toLocaleString('de-DE')}
              </div>
            </div>
          </div>

          {/* KPI Row */}
          {result.treffer.length > 0 && (
            <div className={localStyles.kpiGrid}>
              {(['exact', 'high', 'medium', 'low'] as const).map(level => {
                const count = result.treffer.filter(t => t.matchLevel === level).length;
                return (
                  <div key={level} className={localStyles.kpiCard}>
                    <div
                      className={localStyles.kpiValue}
                      style={assignInlineVars({ [localStyles.accentColorVar]: MATCH_LEVEL_COLOR[level] ?? cssVarV2('text/secondary') })}
                    >
                      {count}
                    </div>
                    <div className={localStyles.kpiLabel}>
                      {MATCH_LEVEL_LABEL[level]}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Treffer List */}
          {visibleTreffer.length > 0 && (
            <div className={localStyles.trefferList}>
              {visibleTreffer.map(t => (
                <TrefferCard key={t.id} treffer={t} onIgnore={handleIgnore} />
              ))}
            </div>
          )}

          {/* Override Section */}
          {criticalCount > 0 && !overrideLogged && (
            <div className={localStyles.overrideBox}>
              <div className={localStyles.overrideTitle}>
                Mandat trotz Kollision annehmen?
              </div>
              <div className={localStyles.overrideHint}>
                Wenn Sie das Mandat trotz der gefundenen Kollision annehmen möchten, müssen Sie eine
                Begründung angeben. Diese wird im Audit-Log dokumentiert.
              </div>
              {!overrideMode ? (
                <button
                  type="button"
                  onClick={() => setOverrideMode(true)}
                  className={localStyles.overrideInitButton}
                >
                  Warnung ignorieren (mit Begründung)
                </button>
              ) : (
                <div className={localStyles.overrideStack}>
                  <textarea
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                    placeholder="Begründung für die Mandatsannahme trotz Kollision…"
                    aria-label="Begründung für Override"
                    rows={3}
                    className={localStyles.overrideTextarea}
                  />
                  <div className={localStyles.overrideButtonRow}>
                    <button
                      type="button"
                      onClick={() => void handleOverride()}
                      disabled={!overrideReason.trim()}
                      className={localStyles.overrideConfirmButton}
                      style={assignInlineVars({
                        [localStyles.surfaceVar]: overrideReason.trim() ? cssVarV2('status/error') : cssVarV2('layer/background/secondary'),
                        [localStyles.accentColorVar]: overrideReason.trim() ? cssVarV2('button/pureWhiteText') : cssVarV2('text/secondary'),
                        [localStyles.opacityVar]: overrideReason.trim() ? '1' : '0.6',
                      })}
                    >
                      Bestätigen & im Audit-Log dokumentieren
                    </button>
                    <button
                      type="button"
                      onClick={() => setOverrideMode(false)}
                      className={localStyles.overrideCancelButton}
                    >
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {overrideLogged && (
            <div className={localStyles.overrideLoggedBanner}>
              Override wurde im Audit-Log dokumentiert. Mandat kann angelegt werden.
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !isLoading && (
        <div className={localStyles.emptyState}>
          <div className={localStyles.emptyIcon}></div>
          <div>Geben Sie einen Namen oder eine Firma ein, um eine Kollisionsprüfung zu starten.</div>
          <div className={localStyles.emptyHint}>
            Pflicht vor jeder Mandatsannahme gem. § 43a BRAO / § 9 RAO
          </div>
        </div>
      )}
    </section>
  );
}
