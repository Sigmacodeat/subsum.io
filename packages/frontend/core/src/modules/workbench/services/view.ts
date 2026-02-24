import { Service } from '@toeverything/infra';

import type { ViewScope } from '../scopes/view';

export class ViewService extends Service {
  static readonly identifierName = 'ViewService';

  view = this.scope.props.view;

  constructor(private readonly scope: ViewScope) {
    super();
  }
}
