import { IReporter } from "./IReporter";
import { IFileFormatter, IFormatter } from "./formatter/IFormatter";
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

        if ("formatToFile" in this.formatter) {
            (this.formatter as IFileFormatter).formatToFile(filePath, data);
        } else {
            const content = (this.formatter as IFormatter).format(data);
            this.storage.save(content, { destination: `${scenario.executionId}/index.html` });
        }
    }
}
