export type TemplateType =
  | 'DEPOSIT_CONTRACT'
  | 'RENTAL_CONTRACT'
  | 'HANDOVER'
  | 'INVOICE'
  | 'RECEIPT'
  | 'DISBURSEMENT';

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  DEPOSIT_CONTRACT: 'Hợp đồng đặt cọc',
  RENTAL_CONTRACT: 'Hợp đồng thuê',
  HANDOVER: 'Biên bản bàn giao',
  INVOICE: 'Hóa đơn thanh toán',
  RECEIPT: 'Phiếu thu',
  DISBURSEMENT: 'Phiếu chi',
};

export interface TemplateVersion {
  id: string;
  versionNo: number;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  changeNote?: string;
  detectedVariables: string[];
  createdAt: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: TemplateType;
  typeDisplay: string;
  description?: string;
  isDefault: boolean;
  active: boolean;
  currentVersionNo: number;
  currentFileName?: string;
  currentFileSize?: number;
  currentFileType?: string;
  currentFileUrl?: string;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentTemplateDetail extends DocumentTemplate {
  currentDetectedVariables: string[];
  versions: TemplateVersion[];
  usedInExport: boolean;
}

export interface TemplateVariable {
  key: string;
  description: string;
  type: TemplateType;
  required: boolean;
  sampleValue?: string;
}

export interface ValidationResult {
  valid: boolean;
  detectedVariables: string[];
  missingRequiredVariables: string[];
  unsupportedVariables: string[];
}
