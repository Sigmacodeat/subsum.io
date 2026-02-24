import {
  DocAction,
  DocRole,
  OrgAction,
  OrgRole,
  WorkspaceAction,
  WorkspaceRole,
} from './types';

export type ResourceType = 'org' | 'ws' | 'doc';

interface OrgResource {
  type: 'org';
  payload: {
    organizationId: string;
    userId: string;
  };
  action: OrgAction;
  role: OrgRole;
}

interface WorkspaceResource {
  type: 'ws';
  payload: {
    allowLocal?: boolean;
    workspaceId: string;
    userId: string;
  };
  action: WorkspaceAction;
  role: WorkspaceRole;
}

interface DocResource {
  type: 'doc';
  payload: {
    allowLocal?: boolean;
    workspaceId: string;
    docId: string;
    userId: string;
  };
  action: DocAction;
  role: DocRole;
}

export type KnownResource = OrgResource | WorkspaceResource | DocResource;
export type Resource<Type extends ResourceType = 'ws'> = Extract<
  KnownResource,
  { type: Type }
>['payload'];

export type ResourceRole<Type extends ResourceType> = Extract<
  KnownResource,
  { type: Type }
>['role'];

export type ResourceAction<Type extends ResourceType> = Extract<
  KnownResource,
  { type: Type }
>['action'];
