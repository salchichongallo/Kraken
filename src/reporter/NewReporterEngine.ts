import { IReporter } from "./IReporter";
import { IFormatter } from "./formatter/IFormatter";
import { IStorage } from "./storage/IStorage";
import { ReportGenerator } from "./generator/ReportGenerator";
import { TestScenario } from "../TestScenario";
import * as path from "path";
import * as fs from "fs";

export class NewReporterEngine implements IReporter {
    constructor(
        private formatter: IFormatter,
        private storage: IStorage,
        private generator: ReportGenerator
    ) { }

    createReport(scenario: TestScenario): void {
        const basePath = `${scenario.executionId}`;
        const assetsDest = `${basePath}/assets`;

        this.storage.ensureFolder(basePath);
        this.storage.ensureFolder(assetsDest);

        for (const device of scenario.devices) {
            if (!device) continue;
            this.storage.ensureFolder(`${basePath}/${device.id}`);
        }

        const devicesData = this.generator.generateDevicesJson(scenario);
        this.storage.save(JSON.stringify(devicesData, null, 2), {
            destination: `${basePath}/devices.json`,
        });

        const sourceAssetsPath = path.resolve(__dirname, "../../reporter/assets");
        const targetAssetsPath = path.resolve("./reports", assetsDest);

        this.copyAssetsRecursive(sourceAssetsPath, targetAssetsPath);
    }

    saveReport(scenario: TestScenario): void {
        const data = this.generator.generateConsolidatedData(scenario);
        const filePath = this.storage.getPath({
            destination: `${scenario.executionId}/index.pdf`,
        });

        const content = this.formatter.format(data, { filePath });

        if (typeof content === 'string') {
            this.storage.save(content, {
                destination: `${scenario.executionId}/index.html`,
            });
        }
        this.generator.generateFeatureReports(scenario, this.storage)
        this.generator.generateScenarioReports(scenario, this.storage)
    }

    private copyAssetsRecursive(source: string, destination: string): void {
        if (!fs.existsSync(source)) return;

        const entries = fs.readdirSync(source, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                fs.mkdirSync(destPath, { recursive: true });
                this.copyAssetsRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }
}
