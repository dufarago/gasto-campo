export type UserRole = "tecnico" | "executivo" | "gestor" | "financeiro";

export type ExpenseStatus =
  | "rascunho"
  | "pendente_sync"
  | "enviado"
  | "aprovado"
  | "rejeitado";

export type ExpenseCategory =
  | "combustivel"
  | "hotel"
  | "refeicao"
  | "pedagio"
  | "outros";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Expense {
  id: string;
  localId: string;
  serverId: string | null;
  userId: string;
  userName: string;
  userRole: UserRole;
  amount: number;
  invoiceNumber: string;
  date: string;
  category: ExpenseCategory;
  region: string;
  notes: string;
  status: ExpenseStatus;
  imageBlob?: Blob;
  imageDataUrl?: string;
  imagePath?: string | null;
  ocrConfidence: number | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string | null;
  rejectionReason?: string | null;
}

export interface OcrResult {
  amount: number | null;
  invoiceNumber: string | null;
  rawText: string;
  confidence: number;
}

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  combustivel: "Combustível",
  hotel: "Hotel",
  refeicao: "Refeição",
  pedagio: "Pedágio",
  outros: "Outros",
};

export const STATUS_LABELS: Record<ExpenseStatus, string> = {
  rascunho: "Rascunho",
  pendente_sync: "Aguardando envio",
  enviado: "Enviado",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  tecnico: "Técnico",
  executivo: "Executivo",
  gestor: "Gestor",
  financeiro: "Financeiro",
};
