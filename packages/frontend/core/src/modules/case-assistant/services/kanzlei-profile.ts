import { Service } from '@toeverything/infra';

import type { AnwaltProfile, AnwaltRole, KanzleiProfile } from '../types';
import type { CaseAssistantStore } from '../stores/case-assistant';
import type { CaseAccessControlService } from './case-access-control';

function createId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

const ANWALT_ROLE_LABEL: Record<AnwaltRole, string> = {
  partner: 'Partner',
  senior_associate: 'Senior Associate',
  associate: 'Associate',
  counsel: 'Counsel / Of Counsel',
  referendar: 'Referendar',
  other: 'Sonstige',
};

export { ANWALT_ROLE_LABEL };

export class KanzleiProfileService extends Service {
  constructor(
    private readonly store: CaseAssistantStore,
    private readonly accessControlService: CaseAccessControlService
  ) {
    super();
  }

  readonly graph$ = this.store.watchGraph();

  async syncFromBackend(workspaceId: string): Promise<KanzleiProfile | null> {
    const permission = await this.accessControlService.evaluate('kanzlei.manage');
    if (!permission.ok) {
      return await this.getKanzleiProfile();
    }

    try {
      const res = await fetch(`/api/legal/law-firm-profile/${encodeURIComponent(workspaceId)}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });

      if (!res.ok) {
        return await this.getKanzleiProfile();
      }

      const data = (await res.json()) as {
        workspaceId: string;
        name?: string;
        address?: string;
        phone?: string;
        fax?: string;
        email?: string;
        website?: string;
        logoDataUrl?: string;
        updatedAt?: string;
      };

      if (!data?.name) {
        return await this.getKanzleiProfile();
      }

      const now = new Date().toISOString();
      const existing = await this.getKanzleiProfile();
      const profile: KanzleiProfile = {
        id: existing?.id ?? createId('kanzlei'),
        workspaceId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        fax: data.fax,
        email: data.email,
        website: data.website,
        steuernummer: existing?.steuernummer,
        ustIdNr: existing?.ustIdNr,
        iban: existing?.iban,
        bic: existing?.bic,
        bankName: existing?.bankName,
        datevBeraternummer: existing?.datevBeraternummer,
        datevMandantennummer: existing?.datevMandantennummer,
        bmdFirmennummer: existing?.bmdFirmennummer,
        rechtsanwaltskammer: existing?.rechtsanwaltskammer,
        aktenzeichenSchema: existing?.aktenzeichenSchema,
        logoDataUrl: data.logoDataUrl,
        createdAt: existing?.createdAt ?? now,
        updatedAt: data.updatedAt ?? now,
      };

      await this.store.upsertKanzleiProfile(profile);
      return profile;
    } catch {
      return await this.getKanzleiProfile();
    }
  }

  async getKanzleiProfile(): Promise<KanzleiProfile | null> {
    const graph = await this.store.getGraph();
    return graph.kanzleiProfile ?? null;
  }

  async getAnwaelte(): Promise<AnwaltProfile[]> {
    const graph = await this.store.getGraph();
    return Object.values(graph.anwaelte ?? {});
  }

  async getActiveAnwaelte(): Promise<AnwaltProfile[]> {
    const all = await this.getAnwaelte();
    return all.filter(a => a.isActive);
  }

  async getAnwaltById(id: string): Promise<AnwaltProfile | null> {
    const graph = await this.store.getGraph();
    return graph.anwaelte?.[id] ?? null;
  }

  async saveKanzleiProfile(
    input: Omit<KanzleiProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<KanzleiProfile | null> {
    const permission = await this.accessControlService.evaluate('kanzlei.manage');
    if (!permission.ok) {
      return null;
    }

    const now = new Date().toISOString();
    const existing = await this.getKanzleiProfile();

    const profile: KanzleiProfile = {
      id: input.id ?? existing?.id ?? createId('kanzlei'),
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      address: input.address?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      fax: input.fax?.trim() || undefined,
      email: input.email?.trim() || undefined,
      website: input.website?.trim() || undefined,
      steuernummer: input.steuernummer?.trim() || undefined,
      ustIdNr: input.ustIdNr?.trim() || undefined,
      iban: input.iban?.trim().replace(/\s+/g, '') || undefined,
      bic: input.bic?.trim().toUpperCase() || undefined,
      bankName: input.bankName?.trim() || undefined,
      datevBeraternummer: input.datevBeraternummer?.trim() || undefined,
      datevMandantennummer: input.datevMandantennummer?.trim() || undefined,
      bmdFirmennummer: input.bmdFirmennummer?.trim() || undefined,
      rechtsanwaltskammer: input.rechtsanwaltskammer?.trim() || undefined,
      aktenzeichenSchema: input.aktenzeichenSchema?.trim() || undefined,
      logoDataUrl: input.logoDataUrl ?? existing?.logoDataUrl,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await this.store.upsertKanzleiProfile(profile);

    // Persist to backend SSOT (best-effort)
    try {
      await fetch(`/api/legal/law-firm-profile/${encodeURIComponent(profile.workspaceId)}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: profile.name,
          address: profile.address,
          phone: profile.phone,
          fax: profile.fax,
          email: profile.email,
          website: profile.website,
          logoDataUrl: profile.logoDataUrl,
        }),
      });
    } catch {
      // ignore
    }

    return profile;
  }

  async generateNextAktenzeichen(clientDisplayName?: string): Promise<string> {
    const graph = await this.store.getGraph();
    const profile = graph.kanzleiProfile;
    const schema = profile?.aktenzeichenSchema?.trim() || '{year}/{seq}';
    const year = new Date().getFullYear().toString();

    const allMatters = Object.values(graph.matters ?? {});
    const existingNumbers = allMatters
      .map(m => m.externalRef ?? '')
      .filter(Boolean);

    let maxSeq = 0;
    for (const num of existingNumbers) {
      const seqMatch = num.match(/(\d{1,6})/g);
      if (seqMatch) {
        for (const s of seqMatch) {
          const parsed = parseInt(s, 10);
          if (parsed > maxSeq && parsed < 999999) {
            maxSeq = parsed;
          }
        }
      }
    }

    const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
    const clientSlug = (clientDisplayName ?? 'M')
      .replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '')
      .slice(0, 12)
      .toUpperCase() || 'M';

    return schema
      .replace('{year}', year)
      .replace('{seq}', nextSeq)
      .replace('{client}', clientSlug);
  }

  async saveAnwalt(
    input: Omit<AnwaltProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<AnwaltProfile | null> {
    const permission = await this.accessControlService.evaluate('kanzlei.manage');
    if (!permission.ok) {
      return null;
    }

    const now = new Date().toISOString();
    const existingAnwalt = input.id ? await this.getAnwaltById(input.id) : null;
    const workspaceUserId = input.workspaceUserId?.trim() || undefined;
    const workspaceUserEmail = input.workspaceUserEmail?.trim().toLowerCase() || undefined;

    if (
      (workspaceUserId && !workspaceUserEmail) ||
      (!workspaceUserId && workspaceUserEmail)
    ) {
      return null;
    }

    if (
      workspaceUserEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workspaceUserEmail)
    ) {
      return null;
    }

    if (workspaceUserId) {
      const activeAnwaelte = (await this.getActiveAnwaelte()).filter(
        anwalt => anwalt.id !== existingAnwalt?.id
      );
      if (activeAnwaelte.some(anwalt => anwalt.workspaceUserId === workspaceUserId)) {
        return null;
      }
      if (activeAnwaelte.some(anwalt => anwalt.workspaceUserEmail === workspaceUserEmail)) {
        return null;
      }
    }

    const record: AnwaltProfile = {
      id: input.id ?? createId('anwalt'),
      workspaceId: input.workspaceId,
      kanzleiId: input.kanzleiId,
      workspaceUserId,
      workspaceUserEmail,
      title: input.title.trim(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      fachgebiet: input.fachgebiet?.trim() || undefined,
      email: input.email?.trim() || undefined,
      phone: input.phone?.trim() || undefined,
      zulassungsnummer: input.zulassungsnummer?.trim() || undefined,
      role: input.role,
      isActive: input.isActive,
      createdAt: existingAnwalt?.createdAt ?? now,
      updatedAt: now,
    };

    await this.store.upsertAnwalt(record);
    return record;
  }

  async deactivateAnwalt(anwaltId: string): Promise<boolean> {
    const permission = await this.accessControlService.evaluate('kanzlei.manage');
    if (!permission.ok) {
      return false;
    }

    const anwalt = await this.getAnwaltById(anwaltId);
    if (!anwalt) {
      return false;
    }

    const graph = await this.store.getGraph();
    const hasActiveAssignments = Object.values(graph.matters ?? {}).some(matter => {
      if (matter.status !== 'open') {
        return false;
      }
      if (matter.assignedAnwaltId === anwaltId) {
        return true;
      }
      return (matter.assignedAnwaltIds ?? []).includes(anwaltId);
    });
    if (hasActiveAssignments) {
      return false;
    }

    await this.store.upsertAnwalt({
      ...anwalt,
      isActive: false,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }

  async deleteAnwalt(anwaltId: string): Promise<boolean> {
    const permission = await this.accessControlService.evaluate('kanzlei.manage');
    if (!permission.ok) {
      return false;
    }

    return await this.store.deleteAnwalt(anwaltId);
  }

  formatAnwaltDisplayName(anwalt: AnwaltProfile): string {
    const parts: string[] = [];
    if (anwalt.title) {
      parts.push(anwalt.title);
    }
    parts.push(anwalt.firstName, anwalt.lastName);
    return parts.join(' ');
  }

  formatAnwaltForLetterhead(anwalt: AnwaltProfile): string {
    const name = this.formatAnwaltDisplayName(anwalt);
    const extras: string[] = [];
    if (anwalt.fachgebiet) {
      extras.push(anwalt.fachgebiet);
    }
    if (anwalt.zulassungsnummer) {
      extras.push(`Zul.-Nr. ${anwalt.zulassungsnummer}`);
    }
    return extras.length > 0 ? `${name} (${extras.join(', ')})` : name;
  }

  formatKanzleiForLetterhead(profile: KanzleiProfile): string {
    const lines: string[] = [profile.name];
    if (profile.address) {
      lines.push(profile.address);
    }
    const contact: string[] = [];
    if (profile.phone) {
      contact.push(`Tel.: ${profile.phone}`);
    }
    if (profile.fax) {
      contact.push(`Fax: ${profile.fax}`);
    }
    if (contact.length > 0) {
      lines.push(contact.join(' | '));
    }
    if (profile.email) {
      lines.push(profile.email);
    }
    if (profile.website) {
      lines.push(profile.website);
    }
    return lines.join('\n');
  }
}
