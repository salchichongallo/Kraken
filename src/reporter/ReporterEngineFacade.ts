import { IReporter } from "./IReporter";
import { NewReporterEngine } from "./NewReporterEngine";
import { HTMLFormatter } from "./formatter/HTMLFormatter";
import { FileSystemStorage } from "./storage/FileSystemStorage";
import { ReportGenerator } from "./generator/ReportGenerator";
import { TestScenario } from "../TestScenario";
import { OldReporterEngine } from "./legacy/OldReporterEngine";

export class ReporterEngineFacade implements IReporter {
    private legacy = new OldReporterEngine();
    private modern = new NewReporterEngine(
        new HTMLFormatter(),
        new FileSystemStorage(),
        new ReportGenerator()
    );

    private useModern = true;

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
