CREATE TABLE "branches_products" (
	"branch_id" uuid,
	"product_id" uuid,
	"quantity" integer DEFAULT 0 NOT NULL,
	"sale_price" numeric(12,2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branches_products_pkey" PRIMARY KEY("branch_id","product_id"),
	CONSTRAINT "branches_products_quantity_check" CHECK ("quantity" >= 0),
	CONSTRAINT "branches_products_sale_price_check" CHECK ("sale_price" >= 0)
);
--> statement-breakpoint
CREATE INDEX "branches_products_product_id_idx" ON "branches_products" ("product_id");--> statement-breakpoint
ALTER TABLE "branches_products" ADD CONSTRAINT "branches_products_branch_id_branches_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "branches_products" ADD CONSTRAINT "branches_products_product_id_products_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE;