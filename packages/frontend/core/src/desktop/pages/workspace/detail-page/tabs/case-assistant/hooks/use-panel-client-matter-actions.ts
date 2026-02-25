import type {
  CaseAssistantAction,
  CaseAssistantRole,
  CaseFile,
  CasePlatformOrchestrationService,
  ClientKind,
  ClientRecord,
  Jurisdiction,
  MatterRecord,
} from '@affine/core/modules/case-assistant';
import { normalizeAuthorityReferences } from '@affine/core/modules/case-assistant';
import { useCallback } from 'react';

import type { PendingDestructiveAction } from '../panel-types';
import { createLocalRecordId } from '../utils';

function generateFallbackAktenzeichen(existingMatters: MatterRecord[]) {
  const year = new Date().getFullYear();
  let maxSeq = 0;
  for (const matter of existingMatters) {
    const ref = matter.externalRef ?? '';
    const matches = ref.match(/\b(\d{1,6})\b/g);
    if (!matches) {
      continue;
    }
    for (const value of matches) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= maxSeq || parsed > 999999) {
        continue;
      }
      maxSeq = parsed;
    }
  }
  return `AZ-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

function normalizeMatterTitle(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

type Params = {
  caseId: string;
  workspaceId: string;
  currentRole: CaseAssistantRole;
  canAction: (action: CaseAssistantAction) => boolean;
  setIngestionStatus: (status: string) => void;

  caseRecord: CaseFile | null | undefined;
  caseClient: ClientRecord | null;
  caseMatter: MatterRecord | null;
  clients: ClientRecord[];
  matters: MatterRecord[];
  activeJurisdiction: Jurisdiction;

  selectedClientId: string;
  setSelectedClientId: React.Dispatch<React.SetStateAction<string>>;
  selectedMatterId: string;
  setSelectedMatterId: React.Dispatch<React.SetStateAction<string>>;

  clientDraftName: string;
  clientDraftKind: ClientKind;
  clientDraftEmail: string;
  clientDraftPhone: string;
  clientDraftAddress: string;
  clientDraftTags: string;
  clientDraftNotes: string;
  setClientDraftName: React.Dispatch<React.SetStateAction<string>>;
  setClientDraftEmail: React.Dispatch<React.SetStateAction<string>>;
  setClientDraftPhone: React.Dispatch<React.SetStateAction<string>>;
  setClientDraftAddress: React.Dispatch<React.SetStateAction<string>>;
  setClientDraftTags: React.Dispatch<React.SetStateAction<string>>;
  setClientDraftNotes: React.Dispatch<React.SetStateAction<string>>;

  matterDraftTitle: string;
  matterDraftDescription: string;
  matterDraftExternalRef: string;
  matterDraftAuthorityReferences: string;
  matterDraftGericht: string;
  matterDraftPolizei: string;
  matterDraftStaatsanwaltschaft: string;
  matterDraftRichter: string;
  matterDraftGerichtsaktenzeichen: string;
  matterDraftStaatsanwaltschaftAktenzeichen: string;
  matterDraftPolizeiAktenzeichen: string;
  matterDraftStatus: MatterRecord['status'];
  matterDraftJurisdiction: Jurisdiction;
  matterDraftTags: string;
  matterDraftAssignedAnwaltId: string;
  setMatterDraftTitle: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftDescription: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftExternalRef: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftAuthorityReferences: React.Dispatch<
    React.SetStateAction<string>
  >;
  setMatterDraftGericht: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftPolizei: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftStaatsanwaltschaft: React.Dispatch<
    React.SetStateAction<string>
  >;
  setMatterDraftRichter: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftGerichtsaktenzeichen: React.Dispatch<
    React.SetStateAction<string>
  >;
  setMatterDraftStaatsanwaltschaftAktenzeichen: React.Dispatch<
    React.SetStateAction<string>
  >;
  setMatterDraftPolizeiAktenzeichen: React.Dispatch<
    React.SetStateAction<string>
  >;
  setMatterDraftJurisdiction: React.Dispatch<
    React.SetStateAction<Jurisdiction>
  >;
  setMatterDraftTags: React.Dispatch<React.SetStateAction<string>>;
  setMatterDraftAssignedAnwaltId: React.Dispatch<React.SetStateAction<string>>;

  undoClientSnapshot: ClientRecord | null;
  setUndoClientSnapshot: React.Dispatch<
    React.SetStateAction<ClientRecord | null>
  >;
  undoMatterSnapshot: MatterRecord | null;
  setUndoMatterSnapshot: React.Dispatch<
    React.SetStateAction<MatterRecord | null>
  >;

  pendingDestructiveAction: PendingDestructiveAction | null;
  setPendingDestructiveAction: React.Dispatch<
    React.SetStateAction<PendingDestructiveAction | null>
  >;
  lastFocusedElementBeforeDestructiveDialogRef: React.MutableRefObject<HTMLElement | null>;

  casePlatformOrchestrationService: CasePlatformOrchestrationService;
};

export const usePanelClientMatterActions = (params: Params) => {
  const onCreateClient = useCallback(async () => {
    const displayName = params.clientDraftName.trim();
    if (!displayName) {
      params.setIngestionStatus('Bitte einen Mandantennamen angeben.');
      return;
    }

    const created = await params.casePlatformOrchestrationService.upsertClient({
      id: createLocalRecordId('client'),
      workspaceId: params.workspaceId,
      kind: params.clientDraftKind,
      displayName,
      primaryEmail: params.clientDraftEmail.trim() || undefined,
      primaryPhone: params.clientDraftPhone.trim() || undefined,
      address: params.clientDraftAddress.trim() || undefined,
      notes: params.clientDraftNotes.trim() || undefined,
      archived: false,
      tags: params.clientDraftTags
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    });

    if (!created) {
      params.setIngestionStatus(
        `Mandant konnte nicht angelegt werden (Rolle ${params.currentRole}, benötigt: operator).`
      );
      return;
    }

    params.setSelectedClientId(created.id);
    params.setClientDraftName('');
    params.setClientDraftEmail('');
    params.setClientDraftPhone('');
    params.setClientDraftAddress('');
    params.setClientDraftTags('');
    params.setClientDraftNotes('');
    params.setUndoClientSnapshot(null);
    params.setIngestionStatus(`Mandant angelegt: ${created.displayName}.`);
  }, [
    params.casePlatformOrchestrationService,
    params.clientDraftAddress,
    params.clientDraftEmail,
    params.clientDraftKind,
    params.clientDraftName,
    params.clientDraftNotes,
    params.clientDraftPhone,
    params.clientDraftTags,
    params.currentRole,
    params.setClientDraftAddress,
    params.setClientDraftEmail,
    params.setClientDraftName,
    params.setClientDraftNotes,
    params.setClientDraftPhone,
    params.setClientDraftTags,
    params.setIngestionStatus,
    params.setSelectedClientId,
    params.setUndoClientSnapshot,
    params.workspaceId,
  ]);

  const onCreateMatter = useCallback(async () => {
    const effectiveClientId = params.selectedClientId || params.caseClient?.id;
    if (!effectiveClientId) {
      params.setIngestionStatus('Bitte zuerst einen Mandanten auswählen.');
      return;
    }

    const titleValue =
      params.matterDraftTitle.trim() ||
      `Akte ${new Date().toLocaleDateString('de-DE')}`;
    const explicitExternalRef = params.matterDraftExternalRef.trim();
    const resolvedExternalRef =
      explicitExternalRef || generateFallbackAktenzeichen(params.matters);
    const authorityReferences = normalizeAuthorityReferences(
      params.matterDraftAuthorityReferences
    ).values;

    const normalizedTitle = normalizeMatterTitle(titleValue);
    const normalizedRef = explicitExternalRef.toLowerCase();
    const existingMatter = params.matters.find(matter => {
      if (matter.workspaceId !== params.workspaceId) {
        return false;
      }
      const sameClient =
        matter.clientId === effectiveClientId ||
        (matter.clientIds ?? []).includes(effectiveClientId);
      if (!sameClient) {
        return false;
      }
      const matterRef = (matter.externalRef ?? '').trim().toLowerCase();
      if (normalizedRef && matterRef && matterRef === normalizedRef) {
        return true;
      }
      return normalizeMatterTitle(matter.title) === normalizedTitle;
    });

    if (existingMatter) {
      params.setSelectedMatterId(existingMatter.id);
      if (params.caseRecord) {
        const assigned =
          await params.casePlatformOrchestrationService.assignCaseMatter({
            caseId: params.caseId,
            workspaceId: params.workspaceId,
            matterId: existingMatter.id,
          });
        if (!assigned) {
          params.setIngestionStatus(
            `Akte erkannt, aber Case-Verknüpfung fehlgeschlagen (Rolle ${params.currentRole}, benötigt: operator).`
          );
          return;
        }
      }
      params.setIngestionStatus(
        `Bestehende Akte erkannt und zugewiesen: ${existingMatter.title}` +
          `${existingMatter.externalRef ? ` (${existingMatter.externalRef})` : ''}.`
      );
      return;
    }

    const created = await params.casePlatformOrchestrationService.upsertMatter({
      id: createLocalRecordId('matter'),
      workspaceId: params.workspaceId,
      clientId: effectiveClientId,
      jurisdiction: params.matterDraftJurisdiction,
      title: titleValue,
      description: params.matterDraftDescription.trim() || undefined,
      externalRef: resolvedExternalRef,
      authorityReferences:
        authorityReferences.length > 0 ? authorityReferences : undefined,
      gericht: params.matterDraftGericht.trim() || undefined,
      polizei: params.matterDraftPolizei.trim() || undefined,
      staatsanwaltschaft:
        params.matterDraftStaatsanwaltschaft.trim() || undefined,
      richter: params.matterDraftRichter.trim() || undefined,
      gerichtsaktenzeichen:
        params.matterDraftGerichtsaktenzeichen.trim() || undefined,
      staatsanwaltschaftAktenzeichen:
        params.matterDraftStaatsanwaltschaftAktenzeichen.trim() || undefined,
      polizeiAktenzeichen:
        params.matterDraftPolizeiAktenzeichen.trim() || undefined,
      assignedAnwaltId: params.matterDraftAssignedAnwaltId || undefined,
      status: params.matterDraftStatus,
      tags: params.matterDraftTags
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    });

    if (!created) {
      params.setIngestionStatus(
        `Akte konnte nicht angelegt werden (Rolle ${params.currentRole}, benötigt: operator).`
      );
      return;
    }

    params.setSelectedMatterId(created.id);
    if (params.caseRecord) {
      const assigned =
        await params.casePlatformOrchestrationService.assignCaseMatter({
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          matterId: created.id,
        });
      if (!assigned) {
        params.setIngestionStatus(
          `Akte angelegt, aber Case-Verknüpfung fehlgeschlagen (Rolle ${params.currentRole}, benötigt: operator).`
        );
        return;
      }
    }
    params.setMatterDraftJurisdiction(params.activeJurisdiction);
    params.setMatterDraftTitle('');
    params.setMatterDraftDescription('');
    params.setMatterDraftExternalRef('');
    params.setMatterDraftAuthorityReferences('');
    params.setMatterDraftGericht('');
    params.setMatterDraftPolizei('');
    params.setMatterDraftStaatsanwaltschaft('');
    params.setMatterDraftRichter('');
    params.setMatterDraftGerichtsaktenzeichen('');
    params.setMatterDraftStaatsanwaltschaftAktenzeichen('');
    params.setMatterDraftPolizeiAktenzeichen('');
    params.setMatterDraftTags('');
    params.setMatterDraftAssignedAnwaltId('');
    params.setUndoMatterSnapshot(null);
    params.setIngestionStatus(
      explicitExternalRef
        ? `Akte angelegt: ${created.title} (${resolvedExternalRef})${authorityReferences.length > 0 ? ` · ${authorityReferences.length} Behörden-Ref.` : ''}.`
        : `Akte angelegt: ${created.title} (${resolvedExternalRef}, automatisch vergeben)${authorityReferences.length > 0 ? ` · ${authorityReferences.length} Behörden-Ref.` : ''}.`
    );
  }, [
    params.activeJurisdiction,
    params.caseId,
    params.matterDraftJurisdiction,
    params.caseClient,
    params.caseRecord,
    params.casePlatformOrchestrationService,
    params.currentRole,
    params.matterDraftDescription,
    params.matterDraftAssignedAnwaltId,
    params.matterDraftAuthorityReferences,
    params.matterDraftExternalRef,
    params.matterDraftGericht,
    params.matterDraftPolizei,
    params.matterDraftStaatsanwaltschaft,
    params.matterDraftRichter,
    params.matterDraftGerichtsaktenzeichen,
    params.matterDraftStaatsanwaltschaftAktenzeichen,
    params.matterDraftPolizeiAktenzeichen,
    params.matterDraftStatus,
    params.matterDraftTags,
    params.matterDraftTitle,
    params.matters,
    params.selectedClientId,
    params.setIngestionStatus,
    params.setMatterDraftDescription,
    params.setMatterDraftAuthorityReferences,
    params.setMatterDraftExternalRef,
    params.setMatterDraftGericht,
    params.setMatterDraftPolizei,
    params.setMatterDraftStaatsanwaltschaft,
    params.setMatterDraftRichter,
    params.setMatterDraftGerichtsaktenzeichen,
    params.setMatterDraftStaatsanwaltschaftAktenzeichen,
    params.setMatterDraftPolizeiAktenzeichen,
    params.setMatterDraftTags,
    params.setMatterDraftTitle,
    params.setSelectedMatterId,
    params.setUndoMatterSnapshot,
    params.workspaceId,
  ]);

  const onAssignMatterToCase = useCallback(async () => {
    if (!params.caseRecord) {
      params.setIngestionStatus('Case noch nicht initialisiert.');
      return;
    }
    if (!params.selectedMatterId) {
      params.setIngestionStatus('Bitte eine Akte auswählen.');
      return;
    }

    const assigned =
      await params.casePlatformOrchestrationService.assignCaseMatter({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        matterId: params.selectedMatterId,
      });
    if (!assigned) {
      params.setIngestionStatus(
        `Akte konnte nicht zugeordnet werden (Rolle ${params.currentRole}, benötigt: operator).`
      );
      return;
    }
    const assignedMatter = params.matters.find(
      item => item.id === assigned.matterId
    );
    params.setIngestionStatus(
      `Case mit Akte verknüpft: ${assignedMatter?.title ?? assigned.matterId ?? 'unbekannt'}.`
    );
  }, [
    params.activeJurisdiction,
    params.caseId,
    params.casePlatformOrchestrationService,
    params.caseRecord,
    params.currentRole,
    params.matters,
    params.selectedMatterId,
    params.setIngestionStatus,
    params.workspaceId,
  ]);

  const onAssignClientToCase = useCallback(async () => {
    if (!params.caseRecord) {
      params.setIngestionStatus('Case noch nicht initialisiert.');
      return;
    }
    if (!params.selectedClientId) {
      params.setIngestionStatus('Bitte einen Mandanten auswählen.');
      return;
    }

    const selectedClient = params.clients.find(
      item => item.id === params.selectedClientId
    );
    if (!selectedClient) {
      params.setIngestionStatus('Ausgewählter Mandant wurde nicht gefunden.');
      return;
    }

    if (params.caseMatter) {
      const existingClientIds = params.caseMatter.clientIds ?? [
        params.caseMatter.clientId,
      ];
      const normalizedClientIds = [
        selectedClient.id,
        ...existingClientIds.filter(id => id !== selectedClient.id),
      ];

      const normalizedAuthorityRefs = normalizeAuthorityReferences(
        params.caseMatter.authorityReferences ?? []
      ).values;
      const updatedMatter =
        await params.casePlatformOrchestrationService.upsertMatter({
          ...params.caseMatter,
          clientId: selectedClient.id,
          clientIds: normalizedClientIds,
          authorityReferences:
            normalizedAuthorityRefs.length > 0
              ? normalizedAuthorityRefs
              : undefined,
        });
      if (!updatedMatter) {
        params.setIngestionStatus(
          `Mandant konnte nicht zugeordnet werden (Rolle ${params.currentRole}, benötigt: operator).`
        );
        return;
      }
      const assigned =
        await params.casePlatformOrchestrationService.assignCaseMatter({
          caseId: params.caseId,
          workspaceId: params.workspaceId,
          matterId: updatedMatter.id,
        });
      if (!assigned) {
        params.setIngestionStatus(
          'Akte konnte nach Mandantenwechsel nicht dem Case zugeordnet werden.'
        );
        return;
      }
      params.setSelectedMatterId(updatedMatter.id);
      params.setIngestionStatus(
        `Mandant ${selectedClient.displayName} wurde der Akte ${updatedMatter.title} zugeordnet.`
      );
      return;
    }

    const createdMatter =
      await params.casePlatformOrchestrationService.upsertMatter({
        id: createLocalRecordId('matter'),
        workspaceId: params.workspaceId,
        clientId: selectedClient.id,
        clientIds: [selectedClient.id],
        jurisdiction: params.matterDraftJurisdiction,
        title:
          params.caseRecord.title ||
          `Akte ${new Date().toLocaleDateString('de-DE')}`,
        externalRef: generateFallbackAktenzeichen(params.matters),
        authorityReferences: normalizeAuthorityReferences(
          params.matterDraftAuthorityReferences
        ).values,
        gericht: params.matterDraftGericht.trim() || undefined,
        status: 'open',
        tags: ['case-linked'],
      });
    if (!createdMatter) {
      params.setIngestionStatus(
        `Akte konnte nicht erstellt werden (Rolle ${params.currentRole}, benötigt: operator).`
      );
      return;
    }
    const assigned =
      await params.casePlatformOrchestrationService.assignCaseMatter({
        caseId: params.caseId,
        workspaceId: params.workspaceId,
        matterId: createdMatter.id,
      });
    if (!assigned) {
      params.setIngestionStatus(
        'Neue Akte konnte nicht dem Case zugeordnet werden.'
      );
      return;
    }

    params.setSelectedMatterId(createdMatter.id);
    params.setIngestionStatus(
      `Neue Akte ${createdMatter.title} erstellt und mit Mandant ${selectedClient.displayName} verknüpft.`
    );
  }, [
    params.caseId,
    params.caseMatter,
    params.casePlatformOrchestrationService,
    params.caseRecord,
    params.clients,
    params.currentRole,
    params.matterDraftAuthorityReferences,
    params.matterDraftGericht,
    params.matterDraftJurisdiction,
    params.matters,
    params.selectedClientId,
    params.setIngestionStatus,
    params.setSelectedMatterId,
    params.workspaceId,
  ]);

  const onDeleteSelectedClient = useCallback(
    async (explicitClientId?: string) => {
      const clientId =
        explicitClientId ?? params.selectedClientId ?? params.caseClient?.id;
      if (!clientId) {
        params.setIngestionStatus('Bitte einen Mandanten auswählen.');
        return;
      }
      if (!params.canAction('client.manage')) {
        params.setIngestionStatus(
          `Mandanten löschen blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
        );
        return;
      }

      const selectedClient = params.clients.find(item => item.id === clientId);
      if (!selectedClient) {
        params.setIngestionStatus('Mandant konnte nicht gefunden werden.');
        return;
      }

      const ok =
        await params.casePlatformOrchestrationService.deleteClient(clientId);
      if (!ok) {
        params.setIngestionStatus(
          'Mandant konnte nicht gelöscht werden (evtl. nicht archiviert, noch verknüpfte Akten oder unzureichende Rolle).'
        );
        return;
      }
      params.setUndoClientSnapshot(selectedClient);
      if (params.selectedClientId === clientId) {
        params.setSelectedClientId('');
      }
      params.setIngestionStatus(
        `Mandant gelöscht: ${selectedClient.displayName}. Rückgängig verfügbar.`
      );
    },
    [
      params.canAction,
      params.caseClient,
      params.casePlatformOrchestrationService,
      params.clients,
      params.currentRole,
      params.selectedClientId,
      params.setIngestionStatus,
      params.setSelectedClientId,
      params.setUndoClientSnapshot,
    ]
  );

  const onDeleteSelectedMatter = useCallback(
    async (explicitMatterId?: string) => {
      const matterId =
        explicitMatterId ?? params.selectedMatterId ?? params.caseMatter?.id;
      if (!matterId) {
        params.setIngestionStatus('Bitte eine Akte auswählen.');
        return;
      }
      if (!params.canAction('matter.manage')) {
        params.setIngestionStatus(
          `Akten löschen blockiert: Rolle ${params.currentRole} benötigt Operator oder höher.`
        );
        return;
      }

      const selectedMatter = params.matters.find(item => item.id === matterId);
      if (!selectedMatter) {
        params.setIngestionStatus('Akte konnte nicht gefunden werden.');
        return;
      }

      const ok =
        await params.casePlatformOrchestrationService.deleteMatter(matterId);
      if (!ok) {
        params.setIngestionStatus(
          'Akte konnte nicht gelöscht werden (evtl. nicht archiviert, noch verknüpft oder unzureichende Rolle).'
        );
        return;
      }
      params.setUndoMatterSnapshot(selectedMatter);
      if (params.selectedMatterId === matterId) {
        params.setSelectedMatterId('');
      }
      params.setIngestionStatus(
        `Akte gelöscht: ${selectedMatter.title}. Rückgängig verfügbar.`
      );
    },
    [
      params.canAction,
      params.caseMatter,
      params.casePlatformOrchestrationService,
      params.currentRole,
      params.matters,
      params.selectedMatterId,
      params.setIngestionStatus,
      params.setSelectedMatterId,
      params.setUndoMatterSnapshot,
    ]
  );

  const onArchiveSelectedMatter = useCallback(
    async (explicitMatterId?: string) => {
      const matterId = explicitMatterId ?? params.selectedMatterId;
      if (!matterId) {
        params.setIngestionStatus('Bitte zuerst eine Akte auswählen.');
        return;
      }
      const selectedMatter =
        params.matters.find(item => item.id === matterId) ?? null;
      if (!selectedMatter) {
        params.setIngestionStatus('Akte konnte nicht gefunden werden.');
        return;
      }

      const archived =
        await params.casePlatformOrchestrationService.archiveMatter(matterId);
      if (!archived) {
        params.setIngestionStatus(
          `Akte konnte nicht archiviert werden (Rolle ${params.currentRole}, benötigt: operator).`
        );
        return;
      }
      params.setUndoMatterSnapshot(selectedMatter);
      params.setIngestionStatus(`Akte archiviert: ${archived.title}.`);
    },
    [
      params.casePlatformOrchestrationService,
      params.currentRole,
      params.matters,
      params.selectedMatterId,
      params.setIngestionStatus,
      params.setUndoMatterSnapshot,
    ]
  );

  const onArchiveSelectedClient = useCallback(
    async (explicitClientId?: string) => {
      const clientId = explicitClientId ?? params.selectedClientId;
      if (!clientId) {
        params.setIngestionStatus('Bitte zuerst einen Mandanten auswählen.');
        return;
      }
      const selectedClient =
        params.clients.find(item => item.id === clientId) ?? null;
      if (!selectedClient) {
        params.setIngestionStatus('Mandant konnte nicht gefunden werden.');
        return;
      }

      const archived =
        await params.casePlatformOrchestrationService.archiveClient(clientId);
      if (!archived) {
        params.setIngestionStatus(
          `Mandant konnte nicht archiviert werden (Rolle ${params.currentRole}, benötigt: operator).`
        );
        return;
      }
      params.setUndoClientSnapshot(selectedClient);
      params.setIngestionStatus(`Mandant archiviert: ${archived.displayName}.`);
    },
    [
      params.casePlatformOrchestrationService,
      params.clients,
      params.currentRole,
      params.selectedClientId,
      params.setIngestionStatus,
      params.setUndoClientSnapshot,
    ]
  );

  const onUndoClientAction = useCallback(async () => {
    if (!params.undoClientSnapshot) {
      params.setIngestionStatus('Kein Mandanten-Undo verfügbar.');
      return;
    }
    const restored = await params.casePlatformOrchestrationService.upsertClient(
      params.undoClientSnapshot
    );
    if (!restored) {
      params.setIngestionStatus(
        'Mandanten-Undo fehlgeschlagen (Rolle prüfen).'
      );
      return;
    }
    params.setSelectedClientId(restored.id);
    params.setUndoClientSnapshot(null);
    params.setIngestionStatus(
      `Mandant wiederhergestellt: ${restored.displayName}.`
    );
  }, [
    params.casePlatformOrchestrationService,
    params.setIngestionStatus,
    params.setSelectedClientId,
    params.setUndoClientSnapshot,
    params.undoClientSnapshot,
  ]);

  const onUndoMatterAction = useCallback(async () => {
    if (!params.undoMatterSnapshot) {
      params.setIngestionStatus('Kein Akten-Undo verfügbar.');
      return;
    }
    const restored = await params.casePlatformOrchestrationService.upsertMatter(
      params.undoMatterSnapshot
    );
    if (!restored) {
      params.setIngestionStatus('Akten-Undo fehlgeschlagen (Rolle prüfen).');
      return;
    }
    params.setSelectedMatterId(restored.id);
    params.setUndoMatterSnapshot(null);
    params.setIngestionStatus(`Akte wiederhergestellt: ${restored.title}.`);
  }, [
    params.casePlatformOrchestrationService,
    params.setIngestionStatus,
    params.setSelectedMatterId,
    params.setUndoMatterSnapshot,
    params.undoMatterSnapshot,
  ]);

  const onOpenDestructiveActionDialog = useCallback(
    (action: PendingDestructiveAction) => {
      if (
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
      ) {
        params.lastFocusedElementBeforeDestructiveDialogRef.current =
          document.activeElement;
      }
      params.setPendingDestructiveAction(action);
    },
    [
      params.lastFocusedElementBeforeDestructiveDialogRef,
      params.setPendingDestructiveAction,
    ]
  );

  const onRequestDeleteSelectedClient = useCallback(() => {
    const clientId = params.selectedClientId || params.caseClient?.id;
    if (!clientId) {
      params.setIngestionStatus('Bitte einen Mandanten auswählen.');
      return;
    }
    const selectedClient = params.clients.find(item => item.id === clientId);
    if (!selectedClient) {
      params.setIngestionStatus('Mandant konnte nicht gefunden werden.');
      return;
    }
    onOpenDestructiveActionDialog({
      kind: 'client.delete',
      entityId: clientId,
      label: selectedClient.displayName,
    });
  }, [
    onOpenDestructiveActionDialog,
    params.caseClient,
    params.clients,
    params.selectedClientId,
    params.setIngestionStatus,
  ]);

  const onRequestArchiveSelectedClient = useCallback(() => {
    const clientId = params.selectedClientId || params.caseClient?.id;
    if (!clientId) {
      params.setIngestionStatus('Bitte einen Mandanten auswählen.');
      return;
    }
    const selectedClient = params.clients.find(item => item.id === clientId);
    if (!selectedClient) {
      params.setIngestionStatus('Mandant konnte nicht gefunden werden.');
      return;
    }
    onOpenDestructiveActionDialog({
      kind: 'client.archive',
      entityId: clientId,
      label: selectedClient.displayName,
    });
  }, [
    onOpenDestructiveActionDialog,
    params.caseClient,
    params.clients,
    params.selectedClientId,
    params.setIngestionStatus,
  ]);

  const onRequestDeleteSelectedMatter = useCallback(() => {
    const matterId = params.selectedMatterId || params.caseMatter?.id;
    if (!matterId) {
      params.setIngestionStatus('Bitte eine Akte auswählen.');
      return;
    }
    const selectedMatter = params.matters.find(item => item.id === matterId);
    if (!selectedMatter) {
      params.setIngestionStatus('Akte konnte nicht gefunden werden.');
      return;
    }
    onOpenDestructiveActionDialog({
      kind: 'matter.delete',
      entityId: matterId,
      label: selectedMatter.title,
    });
  }, [
    onOpenDestructiveActionDialog,
    params.caseMatter,
    params.matters,
    params.selectedMatterId,
    params.setIngestionStatus,
  ]);

  const onRequestArchiveSelectedMatter = useCallback(() => {
    const matterId = params.selectedMatterId || params.caseMatter?.id;
    if (!matterId) {
      params.setIngestionStatus('Bitte zuerst eine Akte auswählen.');
      return;
    }
    const selectedMatter = params.matters.find(item => item.id === matterId);
    if (!selectedMatter) {
      params.setIngestionStatus('Akte konnte nicht gefunden werden.');
      return;
    }
    onOpenDestructiveActionDialog({
      kind: 'matter.archive',
      entityId: matterId,
      label: selectedMatter.title,
    });
  }, [
    onOpenDestructiveActionDialog,
    params.caseMatter,
    params.matters,
    params.selectedMatterId,
    params.setIngestionStatus,
  ]);

  const onCancelDestructiveAction = useCallback(() => {
    params.setPendingDestructiveAction(null);
    params.setIngestionStatus('Aktion abgebrochen.');
  }, [params.setIngestionStatus, params.setPendingDestructiveAction]);

  const onConfirmDestructiveAction = useCallback(async () => {
    if (!params.pendingDestructiveAction) {
      return;
    }

    const action = params.pendingDestructiveAction;
    params.setPendingDestructiveAction(null);

    if (action.kind === 'client.delete') {
      await onDeleteSelectedClient(action.entityId);
      return;
    }
    if (action.kind === 'client.archive') {
      await onArchiveSelectedClient(action.entityId);
      return;
    }
    if (action.kind === 'matter.delete') {
      await onDeleteSelectedMatter(action.entityId);
      return;
    }
    await onArchiveSelectedMatter(action.entityId);
  }, [
    onArchiveSelectedClient,
    onArchiveSelectedMatter,
    onDeleteSelectedClient,
    onDeleteSelectedMatter,
    params.pendingDestructiveAction,
    params.setPendingDestructiveAction,
  ]);

  return {
    onCreateClient,
    onCreateMatter,
    onAssignMatterToCase,
    onAssignClientToCase,
    onDeleteSelectedClient,
    onDeleteSelectedMatter,
    onArchiveSelectedMatter,
    onArchiveSelectedClient,
    onUndoClientAction,
    onUndoMatterAction,
    onRequestDeleteSelectedClient,
    onRequestArchiveSelectedClient,
    onRequestDeleteSelectedMatter,
    onRequestArchiveSelectedMatter,
    onCancelDestructiveAction,
    onConfirmDestructiveAction,
  };
};
