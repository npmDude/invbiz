ALTER TABLE "role_permissions" RENAME TO "roles_permissions";--> statement-breakpoint
ALTER TABLE "user_branches" RENAME TO "users_branches";--> statement-breakpoint
DROP TABLE "user_roles";--> statement-breakpoint
DROP INDEX "role_permissions_permission_id_idx";--> statement-breakpoint
DROP INDEX "user_branches_branch_id_idx";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role_id" uuid;--> statement-breakpoint
CREATE INDEX "roles_permissions_permission_id_idx" ON "roles_permissions" ("permission_id");--> statement-breakpoint
CREATE INDEX "users_branches_branch_id_idx" ON "users_branches" ("branch_id");--> statement-breakpoint
CREATE INDEX "users_role_id_idx" ON "users" ("role_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_access_check" CHECK ((
        "access_level" IN ('admin', 'superuser')
        AND "role_id" IS NULL
      ) OR (
        "access_level" = 'user'
      ));