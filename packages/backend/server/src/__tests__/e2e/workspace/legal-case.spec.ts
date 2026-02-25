import { app, e2e, Mockers } from '../test';

e2e('legal-case endpoints deny access for non-members', async t => {
  await app.logout();

  const owner = await app.create(Mockers.User);
  const outsider = await app.signup();
  const workspace = await app.create(Mockers.Workspace, { owner });

  // sanity: ensure outsider is not in workspace
  const membership = await app.models.workspaceUser.getActive(workspace.id, outsider.id);
  t.is(membership, null);

  const res = await app.GET(`/api/legal/workspaces/${workspace.id}/clients`);
  t.is(res.status, 403);
});
