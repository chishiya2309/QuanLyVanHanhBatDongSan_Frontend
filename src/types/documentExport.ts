import type { TemplateType } from './documentTemplate';

export type ExportSourceType = TemplateType;
export type ExportFormat = 'PDF' | 'DOCX';

export interface TemplateOption {
  templateId: string;
  name: string;
  type: ExportSourceType;
  isDefault: boolean;
  latestVersionId: string;
  versionNo: number;
  fileType: string;
  detectedVariables: string[];
}

export interface DocumentData {
  type: ExportSourceType;
  values: Record<string, string>;
  tables: Record<string, Array<Record<string, string>>>;
}

export interface DocumentExportOptions {
  sourceSummary: string;
  sourceStatus: string;
  eligibleForExport: boolean;
  ineligibleReason?: string;
  defaultTemplateVersionId?: string;
  availableTemplates: TemplateOption[];
  extractedData: DocumentData;
  templateVariables: string[];
}

export interface ExportDocumentRequest {
  sourceType?: ExportSourceType;
  sourceId?: string;
  templateVersionId?: string;
  format?: ExportFormat;
  overrideValues?: Record<string, string>;
}

export interface PreviewDocumentRequest {
  sourceType?: ExportSourceType;
  sourceId?: string;
  templateVersionId?: string;
  overrideValues?: Record<string, string>;
}

export interface ExportedDocumentItem {
  id: string;
  templateVersionId: string;
  templateName: string;
  versionNo: number;
  fileName: string;
  fileUrl: string;
  downloadUrl: string;
  format: ExportFormat;
  fileSize: number;
  generatedAt: string;
  dataSnapshot?: string;
}

export interface DocumentPreviewResponse {
  previewToken: string;
  previewUrl: string;
  expiresAt: string;
  templateVersionId: string;
  templateName: string;
  versionNo: number;
}
