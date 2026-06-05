export type UserRole = "admin" | "juridico" | "comercial" | "operador";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type UserStatus = "active" | "inactive";
