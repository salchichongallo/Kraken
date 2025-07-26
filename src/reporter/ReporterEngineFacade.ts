import { IReporter } from "./IReporter";
import { NewReporterEngine } from "./NewReporterEngine";
import { HTMLFormatter } from "./formatter/HTMLFormatter";
import { FileSystemStorage } from "./storage/FileSystemStorage";
import { ReportGenerator } from "./generator/ReportGenerator";
import { TestScenario } from "../TestScenario";
import { LegacyReporterBridge } from "./legacy/LegacyReporterBridge";
import { Reporter } from "../reports/Reporter";

export class ReporterEngineFacade implements IReporter {
    private legacy: IReporter;
    private modern = new NewReporterEngine(
        new HTMLFormatter(),
        new FileSystemStorage(),
        new ReportGenerator()
    );

    constructor(scenario: TestScenario) {
      this.legacy = new LegacyReporterBridge(new Reporter(scenario));
    }

    private useModern = process.env.NEW_REPORTER === '1';

    createReport(scenario: TestScenario): void {
        this.getActive().createReport(scenario);
    }

    saveReport(scenario: TestScenario): void {
        this.getActive().saveReport(scenario);
    }

    private getActive(): IReporter {
        return this.useModern ? this.modern : this.legacy;
    }
}
