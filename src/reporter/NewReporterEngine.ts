import { IReporter } from "./IReporter";
import { IFormatter } from "./formatter/IFormatter";
import { IStorage } from "./storage/IStorage";
import { ReportGenerator } from "./generator/ReportGenerator";
import { TestScenario } from "../TestScenario";

export class NewReporterEngine implements IReporter {
    constructor(
        private formatter: IFormatter,
        private storage: IStorage,
        private generator: ReportGenerator
    ) { }

    createReport(scenario: TestScenario): void {
        this.storage.saveDeviceList(scenario);
    }

    saveReport(scenario: TestScenario): void {
        const data = this.generator.generateConsolidatedData(scenario);
        const filePath = this.storage.getPath({
            destination: `${scenario.executionId}/index.pdf`,
        });
        const content = this.formatter.format(data, { filePath });
        if (typeof content === 'string') {
            this.storage.save(content, { destination: `${scenario.executionId}/index.html` });
        }
    }
}
