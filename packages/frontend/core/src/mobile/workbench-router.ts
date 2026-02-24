import type { RouteObject } from 'react-router-dom';

import { Component as All } from './pages/workspace/all.js';
import { Component as Collection } from './pages/workspace/collection/index.js';
import { Component as CollectionDetail } from './pages/workspace/collection/detail.js';
import { Component as Fristen } from './pages/workspace/fristen.js';
import { Component as Home } from './pages/workspace/home.js';
import { Component as Journals } from './pages/workspace/journals.js';
import { Component as Search } from './pages/workspace/search.js';
import { Component as Tag } from './pages/workspace/tag/index.js';
import { Component as TagDetail } from './pages/workspace/tag/detail.js';
import { Component as Termine } from './pages/workspace/termine.js';

export const workbenchRoutes = [
  {
    path: '/home',
    Component: Home,
  },
  {
    path: '/search',
    Component: Search,
  },
  {
    path: '/all',
    Component: All,
  },
  {
    path: '/collection',
    // lazy: () => import('./pages/workspace/collection/index'),
    Component: Collection,
  },
  {
    path: '/collection/:collectionId',
    // lazy: () => import('./pages/workspace/collection/detail'),
    Component: CollectionDetail,
  },
  {
    path: '/tag',
    // lazy: () => import('./pages/workspace/tag/index'),
    Component: Tag,
  },
  {
    path: '/tag/:tagId',
    // lazy: () => import('./pages/workspace/tag/detail'),
    Component: TagDetail,
  },
  {
    path: '/journals',
    // lazy: () => import('./pages/workspace/journals'),
    Component: Journals,
  },
  {
    path: '/fristen',
    Component: Fristen,
  },
  {
    path: '/termine',
    Component: Termine,
  },
  {
    path: '/trash',
    lazy: () => import('./pages/workspace/trash'),
  },
  {
    path: '/:pageId',
    lazy: () => import('./pages/workspace/detail/mobile-detail-page'),
  },
  {
    path: '*',
    lazy: () => import('./pages/404'),
  },
] satisfies [RouteObject, ...RouteObject[]];
