-- CreateTable
CREATE TABLE "revendas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contact_name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "external_code" INTEGER,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT,
    "inscricao_estadual" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "contact_name" TEXT,
    "street" TEXT,
    "address_number" TEXT,
    "address_complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip_code" TEXT,
    "revenda_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "clients_revenda_id_fkey" FOREIGN KEY ("revenda_id") REFERENCES "revendas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_clients" ("address_complement", "address_number", "city", "cnpj", "contact_name", "created_at", "email", "external_code", "id", "inscricao_estadual", "neighborhood", "nome_fantasia", "phone", "razao_social", "state", "status", "street", "updated_at", "zip_code") SELECT "address_complement", "address_number", "city", "cnpj", "contact_name", "created_at", "email", "external_code", "id", "inscricao_estadual", "neighborhood", "nome_fantasia", "phone", "razao_social", "state", "status", "street", "updated_at", "zip_code" FROM "clients";
DROP TABLE "clients";
ALTER TABLE "new_clients" RENAME TO "clients";
CREATE UNIQUE INDEX "clients_external_code_key" ON "clients"("external_code");
CREATE UNIQUE INDEX "clients_cnpj_key" ON "clients"("cnpj");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "revenda_id" TEXT,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_revenda_id_fkey" FOREIGN KEY ("revenda_id") REFERENCES "revendas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("created_at", "email", "id", "last_login_at", "name", "password_hash", "role", "status", "updated_at") SELECT "created_at", "email", "id", "last_login_at", "name", "password_hash", "role", "status", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
