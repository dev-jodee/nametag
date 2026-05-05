-- DropIndex
DROP INDEX "custom_field_templates_userId_slug_key";

-- CreateIndex
CREATE INDEX "custom_field_templates_userId_slug_idx" ON "custom_field_templates"("userId", "slug");

-- CreateIndex
-- Partial unique index: enforces uniqueness on (userId, slug) only for non-deleted rows.
-- This lets users recreate a template with the same name after soft-deleting the previous one.
CREATE UNIQUE INDEX "custom_field_templates_userId_slug_active_key"
  ON "custom_field_templates"("userId", "slug")
  WHERE "deletedAt" IS NULL;
