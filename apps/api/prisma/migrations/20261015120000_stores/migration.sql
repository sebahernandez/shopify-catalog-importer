-- CreateTable
CREATE TABLE "store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "display_name" TEXT NOT NULL,
    "shop_domain" TEXT NOT NULL,
    "shopify_shop_id" TEXT,
    "api_version" TEXT,
    "auth_kind" TEXT NOT NULL,
    "credentials_envelope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "last_verified_at" DATETIME,
    "last_verification" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "store_shop_domain_key" ON "store"("shop_domain");
