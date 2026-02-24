import { Button } from '@affine/component';
import type { NormMatchResult } from '@affine/core/modules/case-assistant';
import { cssVarV2 } from '@toeverything/theme/v2';
import { assignInlineVars } from '@vanilla-extract/dynamic';
import { memo, useState } from 'react';

import * as styles from '../../case-assistant.css';
import * as localStyles from './norm-search-section.css';

const JURISDICTION_LABEL: Record<string, string> = {
  DE: '🇩🇪 DE',
  AT: '🇦🇹 AT',
  ECHR: '🇪🇺 EMRK',
  EU: '🇪🇺 EU',
};

const DOMAIN_COLOR: Record<string, string> = {
  civil: cssVarV2('button/primary'),
  criminal: cssVarV2('status/error'),
  administrative: cssVarV2('text/primary'),
  constitutional: cssVarV2('button/primary'),
  labor: cssVarV2('status/success'),
  tax: cssVarV2('text/primary'),
  commercial: cssVarV2('text/secondary'),
};

const TYPE_LABEL: Record<string, string> = {
  anspruchsgrundlage: 'Anspruchsgrundlage',
  einwendung: 'Einwendung',
  verfahrensvorschrift: 'Verfahren',
  beweislast: 'Beweislast',
  straftatbestand: 'Straftatbestand',
  schutzgesetz: 'Schutzgesetz',
};

type Props = {
  normSearchQuery: string;
  setNormSearchQuery: (value: string) => void;
  onSearchNorms: () => Promise<void>;
  runAsyncUiAction: (action: () => void | Promise<unknown>, errorContext: string) => void;
  normSearchResults: NormMatchResult[];
};

export const NormSearchSection = memo((props: Props) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>('all');
  const [copied, setCopied] = useState<string | null>(null);

  const results = jurisdictionFilter === 'all'
    ? props.normSearchResults
    : props.normSearchResults.filter(r => (r.norm.jurisdiction ?? '') === jurisdictionFilter);

  const jurisdictions = [...new Set(
    props.normSearchResults
      .map(r => r.norm.jurisdiction as string | undefined)
      .filter((j): j is string => typeof j === 'string' && j.length > 0)
  )];

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <details className={styles.toolAccordion}>
      <summary className={styles.toolAccordionSummary}>
        Normensuche (DE · AT · EMRK)
        {props.normSearchResults.length > 0 ? ` · ${props.normSearchResults.length} Treffer` : ''}
      </summary>

      <div className={styles.formGrid}>
        <label className={styles.formLabel}>
          Sachverhalt / Suchbegriff
          <input
            className={styles.input}
            value={props.normSearchQuery}
            onChange={e => props.setNormSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                props.runAsyncUiAction(props.onSearchNorms, 'norm search failed');
              }
            }}
            placeholder="z. B. Schadensersatz Pflichtverletzung, Mietrecht, Art. 6 EMRK …"
            aria-label="Normen-Suchbegriff"
          />
        </label>
      </div>

      <div className={styles.quickActionRow}>
        <Button variant="secondary" onClick={() => props.runAsyncUiAction(props.onSearchNorms, 'norm search failed')}>
          Normen suchen
        </Button>
      </div>

      {results.length > 0 ? (
        <>
          {/* Jurisdiktion-Filter */}
          {jurisdictions.length > 1 ? (
            <div className={localStyles.filterRow}>
              <button type="button" onClick={() => setJurisdictionFilter('all')}
                aria-pressed={jurisdictionFilter === 'all'}
                className={`${localStyles.filterButton} ${jurisdictionFilter === 'all' ? localStyles.filterButtonActive : ''}`}
                style={assignInlineVars({
                  [localStyles.accentColorVar]: jurisdictionFilter === 'all' ? cssVarV2('button/primary') : cssVarV2('text/secondary'),
                  [localStyles.borderVar]: jurisdictionFilter === 'all' ? cssVarV2('button/primary') : cssVarV2('layer/insideBorder/border'),
                })}
              >
                Alle ({props.normSearchResults.length})
              </button>
              {jurisdictions.map(j => (
                <button key={j} type="button" onClick={() => setJurisdictionFilter(j ?? '')}
                  aria-pressed={jurisdictionFilter === (j ?? '')}
                  className={`${localStyles.filterButton} ${jurisdictionFilter === (j ?? '') ? localStyles.filterButtonActive : ''}`}
                  style={assignInlineVars({
                    [localStyles.accentColorVar]: jurisdictionFilter === (j ?? '') ? cssVarV2('button/primary') : cssVarV2('text/secondary'),
                    [localStyles.borderVar]: jurisdictionFilter === (j ?? '') ? cssVarV2('button/primary') : cssVarV2('layer/insideBorder/border'),
                  })}
                >
                  {JURISDICTION_LABEL[j ?? ''] ?? j}
                </button>
              ))}
            </div>
          ) : null}

          <ul className={localStyles.resultsList}>
            {results.map(result => {
              const norm = result.norm;
              const isExp = expandedId === norm.id;
              const domainColor = DOMAIN_COLOR[norm.domain] ?? cssVarV2('text/secondary');

              return (
                <li key={norm.id} className={localStyles.resultItem}>
                  <button type="button" onClick={() => setExpandedId(isExp ? null : norm.id)}
                    aria-expanded={isExp}
                    className={localStyles.resultButton}
                  >
                    <div className={localStyles.resultMain}>
                      <div className={localStyles.badgeRow}>
                        <span
                          className={localStyles.lawBadge}
                          style={assignInlineVars({ [localStyles.accentColorVar]: domainColor })}
                        >
                          {norm.law} {norm.paragraph}
                        </span>
                        <span className={localStyles.tinyMuted}>
                          {JURISDICTION_LABEL[norm.jurisdiction ?? ''] ?? norm.jurisdiction ?? ''}
                        </span>
                        <span className={localStyles.typeBadge}>
                          {TYPE_LABEL[norm.type] ?? norm.type}
                        </span>
                        <span
                          className={localStyles.matchText}
                          style={assignInlineVars({ [localStyles.accentColorVar]: domainColor })}
                        >
                          {Math.round(result.matchScore * 100)}% Match
                        </span>
                      </div>
                      <div className={`${localStyles.title} ${isExp ? localStyles.titleExpanded : ''}`}>
                        {norm.title}
                      </div>
                      {!isExp ? (
                        <div className={localStyles.subtitle}>
                          {norm.shortDescription}
                        </div>
                      ) : null}
                    </div>
                    <div className={localStyles.rightActions}>
                      <button type="button"
                        title="Norm-Referenz kopieren"
                        onClick={e => { e.stopPropagation(); copyToClipboard(`${norm.paragraph} ${norm.law}`, norm.id); }}
                        className={localStyles.copyButton}
                        style={assignInlineVars({
                          [localStyles.surfaceVar]: copied === norm.id ? cssVarV2('layer/background/secondary') : 'transparent',
                          [localStyles.accentColorVar]: copied === norm.id ? cssVarV2('status/success') : cssVarV2('text/secondary'),
                        })}
                      >
                        {copied === norm.id ? '✓' : '⎘'}
                      </button>
                      <span className={localStyles.caret}>{isExp ? 'Schließen' : 'Öffnen'}</span>
                    </div>
                  </button>

                  {isExp ? (
                    <div className={localStyles.expandedPanel}>
                      <div className={localStyles.summaryBox}>
                        {norm.shortDescription}
                      </div>

                      {norm.prerequisites.length > 0 ? (
                        <div>
                          <div className={localStyles.sectionLabel}>Voraussetzungen</div>
                          <ul className={localStyles.prereqList}>
                            {norm.prerequisites.map((p, i) => (
                              <li key={i} className={localStyles.prereqItem}>
                                <span className={localStyles.prereqIndex}>{i + 1}.</span> {p}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className={localStyles.consequenceBox}>
                        <div className={localStyles.consequenceTitle}>RECHTSFOLGE</div>
                        <div className={localStyles.consequenceText}>{norm.legalConsequence}</div>
                      </div>

                      {norm.burdenOfProof ? (
                        <div className={localStyles.metaLine}>
                          <strong>Beweislast:</strong> {norm.burdenOfProof}
                        </div>
                      ) : null}

                      {result.matchedKeywords.length > 0 ? (
                        <div className={localStyles.keywordsRow}>
                          {result.matchedKeywords.map(kw => (
                            <span key={kw} className={localStyles.keywordPill}>
                              {kw}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {norm.relatedNorms.length > 0 ? (
                        <div className={localStyles.metaLine}>
                          <strong>Verwandte Normen:</strong> {norm.relatedNorms.join(' · ')}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : props.normSearchQuery.length > 0 ? (
        <div className={`${styles.empty} ${localStyles.emptyCompact}`}>
          Keine Normen gefunden. Versuche andere Suchbegriffe.
        </div>
      ) : null}
    </details>
  );
});

NormSearchSection.displayName = 'NormSearchSection';
