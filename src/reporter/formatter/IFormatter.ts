import { ReportData } from "../generator/ReportData";

export interface IFormatter {
  format(data: ReportData, options?: { filePath?: string }): string | void;
}