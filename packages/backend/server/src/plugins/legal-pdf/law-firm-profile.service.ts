import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

import type { LawFirmProfileRecord } from './law-firm-profile.types';

const LawFirmProfileInputSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  footerNote: z.string().optional(),
  logoDataUrl: z.string().optional(),
});

function appConfigKey(workspaceId: string) {
  return `legal.lawFirmProfile.${workspaceId}`;
}

@Injectable()
export class LawFirmProfileService {
  constructor(private readonly db: PrismaClient) {}

  async get(workspaceId: string): Promise<LawFirmProfileRecord | null> {
    const record = await this.db.appConfig.findUnique({
      where: { id: appConfigKey(workspaceId) },
    });

    if (!record) {
      return null;
    }

    const value = record.value as any;
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      workspaceId,
      name: typeof value.name === 'string' ? value.name : '',
      address: typeof value.address === 'string' ? value.address : undefined,
      phone: typeof value.phone === 'string' ? value.phone : undefined,
      fax: typeof value.fax === 'string' ? value.fax : undefined,
      email: typeof value.email === 'string' ? value.email : undefined,
      website: typeof value.website === 'string' ? value.website : undefined,
      footerNote: typeof value.footerNote === 'string' ? value.footerNote : undefined,
      logoDataUrl: typeof value.logoDataUrl === 'string' ? value.logoDataUrl : undefined,
      updatedAt: record.updatedAt.toISOString(),
      updatedBy: record.lastUpdatedBy ?? undefined,
    };
  }

  async upsert(params: {
    workspaceId: string;
    input: unknown;
    userId: string;
  }): Promise<LawFirmProfileRecord> {
    const parsed = LawFirmProfileInputSchema.parse(params.input);

    const updated = await this.db.appConfig.upsert({
      where: { id: appConfigKey(params.workspaceId) },
      update: {
        value: parsed as any,
        lastUpdatedBy: params.userId,
      },
      create: {
        id: appConfigKey(params.workspaceId),
        value: parsed as any,
        lastUpdatedBy: params.userId,
      },
    });

    return {
      workspaceId: params.workspaceId,
      name: parsed.name,
      address: parsed.address,
      phone: parsed.phone,
      fax: parsed.fax,
      email: parsed.email,
      website: parsed.website,
      footerNote: parsed.footerNote,
      logoDataUrl: parsed.logoDataUrl,
      updatedAt: updated.updatedAt.toISOString(),
      updatedBy: updated.lastUpdatedBy ?? undefined,
    };
  }
}
