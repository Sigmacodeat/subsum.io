export type LawFirmProfileRecord = {
  workspaceId: string;
  name: string;
  address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  /** Custom footer note appended above the standard disclaimer */
  footerNote?: string;
  /** Data URL (kept small). Later we should evolve to blob refs. */
  logoDataUrl?: string;
  updatedAt: string;
  updatedBy?: string;
};
