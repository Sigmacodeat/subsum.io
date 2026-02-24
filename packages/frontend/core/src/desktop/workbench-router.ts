import type { RouteObject } from 'react-router-dom';

export const workbenchRoutes = [
  {
    path: '/chat',
    lazy: () => import('./pages/workspace/chat/index'),
  },
  {
    path: '/all',
    lazy: () => import('./pages/workspace/all-page/all-page'),
  },
  {
    path: '/akten',
    lazy: () => import('./pages/workspace/all-akten/all-akten'),
  },
  {
    path: '/akten/:matterId',
    lazy: () => import('./pages/workspace/akte-detail/akte-detail-page'),
  },
  {
    path: '/mandanten',
    lazy: () => import('./pages/workspace/all-mandanten/all-mandanten'),
  },
  {
    path: '/mandanten/:clientId',
    lazy: () => import('./pages/workspace/mandant-detail/mandant-detail-page'),
  },
  {
    path: '/fristen',
    lazy: () => import('./pages/workspace/all-fristen/all-fristen'),
  },
  {
    path: '/termine',
    lazy: () => import('./pages/workspace/all-termine/all-termine'),
  },
  {
    path: '/collection',
    lazy: () => import('./pages/workspace/all-collection'),
  },
  {
    path: '/collection/:collectionId',
    lazy: () => import('./pages/workspace/collection/index'),
  },
  {
    path: '/tag',
    lazy: () => import('./pages/workspace/all-tag'),
  },
  {
    path: '/tag/:tagId',
    lazy: () => import('./pages/workspace/tag'),
  },
  {
    path: '/trash',
    lazy: () => import('./pages/workspace/trash-page'),
  },
  {
    path: '/:pageId',
    lazy: () => import('./pages/workspace/detail-page/detail-page'),
  },
  {
    path: '/:pageId/attachments/:attachmentId',
    lazy: () => import('./pages/workspace/attachment/index'),
  },
  {
    path: '/journals',
    lazy: () => import('./pages/workspace/journals'),
  },
  {
    path: '/settings',
    lazy: () => import('./pages/workspace/settings'),
  },
  {
    path: '*',
    lazy: () => import('./pages/404'),
  },
] satisfies RouteObject[];
