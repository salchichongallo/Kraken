import PDFDocument from "pdfkit";
import { ReportData } from "../generator/ReportData";
import { PassThrough } from "stream";
import { IFileFormatter } from "./IFileFormatter";

export class PDFFormatter implements IFileFormatter {
    async formatToBuffer(data: ReportData): Promise<Buffer> {
        const doc = new PDFDocument();
        const stream = new PassThrough();
        const chunks: Buffer[] = [];

        return new Promise((resolve, reject) => {
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
            stream.on("error", reject);

            doc.pipe(stream);

            doc.fontSize(20).text("Reporte Consolidado de Pruebas", { align: "center" });

            doc.moveDown();
            doc.fontSize(14).text("Métricas Generales", { underline: true });
            doc.moveDown(0.5);
            for (const [key, value] of Object.entries(data.metrics)) {
                doc.fontSize(12).text(`${key}: ${value}`);
            }

            doc.moveDown();
            doc.fontSize(14).text("Resumen de Ejecución", { underline: true });
            doc.moveDown(0.5);
            const nodes = data.graph?.nodes ?? [];
            const links = data.graph?.links ?? [];
            doc.fontSize(12).text(`Total de Nodos: ${nodes.length}`);
            doc.fontSize(12).text(`Total de Enlaces: ${links.length}`);

            doc.end();
        });
    }
}
