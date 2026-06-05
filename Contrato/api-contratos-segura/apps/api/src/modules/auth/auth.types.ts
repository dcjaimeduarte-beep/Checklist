export type UserRole = "admin" | "juridico" | "comercial" | "operador" | "revenda";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  revendaId?: string | null;
};

export type UserStatus = "active" | "inactive";
