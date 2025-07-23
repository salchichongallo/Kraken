import PDFDocument from "pdfkit";
import { IFileFormatter } from "./IFormatter";
import { ReportData } from "../generator/ReportData";
import * as fs from "fs";
import * as path from "path";

export class PDFFormatter implements IFileFormatter {
    formatToFile(filePath: string, data: ReportData): void {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });

        const doc = new PDFDocument();
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        doc.fontSize(20).text("Reporte Consolidado de Pruebas", {
            align: "center",
        });

        doc.moveDown();

        doc.fontSize(14).text("Métricas Generales", { underline: true });
        doc.moveDown(0.5);

        for (const [key, value] of Object.entries(data.metrics)) {
            doc.fontSize(12).text(`${key}: ${value}`);
        }

        doc.moveDown();

        doc.fontSize(14).text("Resumen de Red de Ejecución", { underline: true });
        doc.moveDown(0.5);

        const nodes = data.graph?.nodes ?? [];
        const links = data.graph?.links ?? [];

        doc.fontSize(12).text(`Total de Nodos: ${nodes.length}`);
        doc.fontSize(12).text(`Total de Enlaces: ${links.length}`);

        doc.end();
    }
}
