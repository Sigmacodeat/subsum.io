-- CreateEnum
CREATE TYPE "OrganizationMemberStatus" AS ENUM ('Pending', 'Accepted');

-- CreateTable
CREATE TABLE "organizations" (
    "id" VARCHAR NOT NULL,
    "name" VARCHAR NOT NULL,
    "slug" VARCHAR NOT NULL,
    "avatar_key" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_user_roles" (
    "id" VARCHAR NOT NULL,
    "organization_id" VARCHAR NOT NULL,
    "user_id" VARCHAR NOT NULL,
    "type" SMALLINT NOT NULL,
    "status" "OrganizationMemberStatus" NOT NULL DEFAULT 'Pending',
    "inviter_id" VARCHAR,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_user_roles_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add organizationId to workspaces
ALTER TABLE "workspaces" ADD COLUMN "organization_id" VARCHAR;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_slug_idx" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_user_roles_organization_id_user_id_key" ON "organization_user_roles"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX "organization_user_roles_organization_id_type_status_idx" ON "organization_user_roles"("organization_id", "type", "status");

-- CreateIndex
CREATE INDEX "organization_user_roles_user_id_idx" ON "organization_user_roles"("user_id");

-- CreateIndex
CREATE INDEX "workspaces_organization_id_idx" ON "workspaces"("organization_id");

-- AddForeignKey
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
