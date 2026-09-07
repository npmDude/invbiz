CREATE TABLE "products_categories" (
	"product_id" uuid,
	"category_id" uuid,
	CONSTRAINT "products_categories_pkey" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(64) NOT NULL,
	"supplier_price" numeric(12,2) NOT NULL,
	"description" text,
	"stock_alert" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_supplier_price_check" CHECK ("supplier_price" >= 0),
	CONSTRAINT "products_stock_alert_check" CHECK ("stock_alert" IS NULL OR "stock_alert" >= 0)
);
--> statement-breakpoint
CREATE INDEX "products_categories_category_id_idx" ON "products_categories" ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_organization_id_name_idx" ON "products" ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "products_organization_id_code_idx" ON "products" ("organization_id","code");--> statement-breakpoint
CREATE INDEX "products_organization_id_idx" ON "products" ("organization_id");--> statement-breakpoint
ALTER TABLE "products_categories" ADD CONSTRAINT "products_categories_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "products_categories" ADD CONSTRAINT "products_categories_category_id_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;