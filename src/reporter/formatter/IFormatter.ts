import { ReportData } from "../generator/ReportData";

export interface IFormatter {
  format(data: ReportData): string;
}

export interface IFileFormatter {
  formatToFile(path: string, data: ReportData): void;
}