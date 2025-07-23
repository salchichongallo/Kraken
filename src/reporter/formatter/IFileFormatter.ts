import { ReportData } from "../generator/ReportData";

export interface IFileFormatter {
    formatToBuffer(data: ReportData): Promise<Buffer>;
}
