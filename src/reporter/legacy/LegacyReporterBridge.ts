import { IReporter } from "../IReporter";
import { Reporter } from "../../reports/Reporter";

export class LegacyReporterBridge implements IReporter {
    constructor(private readonly legacy: Reporter) {
    }

    createReport() {
      return this.legacy.createReportFolderRequirements();
    }

    saveReport() {
      return this.legacy.saveReport();
    }
}
