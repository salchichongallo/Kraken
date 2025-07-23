import { IFormatter } from "./IFormatter";
import { ReportData } from "../generator/ReportData";
import * as ejs from "ejs";
import * as fs from "fs";
import * as path from "path";

export class HTMLFormatter implements IFormatter {
    private templatePath = path.join(__dirname, "..", "..", "templates", "index.html.ejs");

    format(data: ReportData): string {
        const template = fs.readFileSync(this.templatePath, "utf-8");
        return ejs.render(template, data);
    }
}
