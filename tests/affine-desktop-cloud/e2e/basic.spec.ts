import { test } from '@affine-test/kit/electron';
import {
  createRandomUser,
  enableCloudWorkspace,
  loginUser,
} from '@affine-test/kit/utils/cloud';
import { waitForEditorLoad } from '@affine-test/kit/utils/page-logic';
import { createLocalWorkspace } from '@affine-test/kit/utils/workspace';

process.env.DEV_SERVER_URL = new URL(
  process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080/'
).origin;

let user: {
  name: string;
  email: string;
  password: string;
};

test.beforeEach(async () => {
  user = await createRandomUser();
});

test('new page', async ({ page }) => {
  await loginUser(page, user, {
    isElectron: true,
  });
  await waitForEditorLoad(page);
  await createLocalWorkspace(
    {
      name: 'test',
    },
    page
  );
  await enableCloudWorkspace(page);
});
