import { Service } from '@toeverything/infra';

import type { CaseAssistantStore } from '../stores/case-assistant';
import type { CaseAssistantAction, CaseAssistantRole } from '../types';

const roleRank: Record<CaseAssistantRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

const actionRequiredRole: Record<CaseAssistantAction, CaseAssistantRole> = {
  'connector.configure': 'admin',
  'connector.toggle': 'admin',
  'connector.healthcheck': 'operator',
  'connector.rotate': 'operator',
  'connector.clear_auth': 'admin',
  'connector.dispatch': 'operator',
  'case.manage': 'operator',
  'client.manage': 'operator',
  'matter.manage': 'operator',
  'audit.export': 'admin',
  'audit.verify': 'operator',
  'job.cancel': 'operator',
  'job.retry': 'operator',
  'document.upload': 'operator',
  'document.ocr': 'operator',
  'document.analyze': 'operator',
  'task.manage': 'operator',
  'blueprint.manage': 'operator',
  'copilot.execute': 'operator',
  'kanzlei.manage': 'admin',
  'residency.manage': 'admin',
  'folder.search': 'viewer',
  'folder.summarize': 'operator',
  'bulk.execute': 'operator',
  'email.send': 'operator',
  'opposing_party.manage': 'operator',
  'deadline.manage': 'operator',
  'finding.manage': 'operator',
};

export class CaseAccessControlService extends Service {
  constructor(private readonly store: CaseAssistantStore) {
    super();
  }

  readonly role$ = this.store.watchRole();

  async getRole() {
    return await this.store.getRole();
  }

  async setRole(role: CaseAssistantRole) {
    await this.store.setRole(role);
  }

  requiredRole(action: CaseAssistantAction): CaseAssistantRole {
    return actionRequiredRole[action];
  }

  async can(action: CaseAssistantAction) {
    const role = (await this.getRole()) as CaseAssistantRole;
    const requiredRole = this.requiredRole(action);
    return roleRank[role] >= roleRank[requiredRole];
  }

  async evaluate(action: CaseAssistantAction) {
    const role = (await this.getRole()) as CaseAssistantRole;
    const requiredRole = this.requiredRole(action);
    const ok = roleRank[role] >= roleRank[requiredRole];

    return {
      ok,
      role,
      requiredRole,
      message: ok
        ? 'allowed'
        : `Aktion '${action}' benötigt Rolle '${requiredRole}' (aktuell: '${role}')`,
    };
  }
}
