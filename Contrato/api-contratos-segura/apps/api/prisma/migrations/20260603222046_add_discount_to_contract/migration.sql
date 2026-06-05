-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "identifier" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "duration_months" INTEGER NOT NULL DEFAULT 12,
    "signed_at" DATETIME,
    "is_signed" BOOLEAN NOT NULL DEFAULT false,
    "implementation_fee" REAL NOT NULL DEFAULT 0,
    "implementation_payment" TEXT NOT NULL DEFAULT 'avista',
    "monthly_fee" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "payment_day_of_month" INTEGER NOT NULL DEFAULT 10,
    "first_payment_date" DATETIME,
    "adjustment_index" TEXT NOT NULL DEFAULT 'IGPM',
    "module_cadastros" BOOLEAN NOT NULL DEFAULT false,
    "module_faturamento" BOOLEAN NOT NULL DEFAULT false,
    "module_fiscal" BOOLEAN NOT NULL DEFAULT false,
    "distance_from_provider_km" INTEGER,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "contracts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_contracts" ("adjustment_index", "client_id", "created_at", "distance_from_provider_km", "duration_months", "end_date", "first_payment_date", "id", "identifier", "implementation_fee", "implementation_payment", "is_signed", "module_cadastros", "module_faturamento", "module_fiscal", "monthly_fee", "notes", "payment_day_of_month", "signed_at", "start_date", "status", "updated_at") SELECT "adjustment_index", "client_id", "created_at", "distance_from_provider_km", "duration_months", "end_date", "first_payment_date", "id", "identifier", "implementation_fee", "implementation_payment", "is_signed", "module_cadastros", "module_faturamento", "module_fiscal", "monthly_fee", "notes", "payment_day_of_month", "signed_at", "start_date", "status", "updated_at" FROM "contracts";
DROP TABLE "contracts";
ALTER TABLE "new_contracts" RENAME TO "contracts";
CREATE UNIQUE INDEX "contracts_identifier_key" ON "contracts"("identifier");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
