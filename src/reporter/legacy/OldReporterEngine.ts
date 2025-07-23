import { IReporter } from "../IReporter";
import * as ejs from "ejs";
import * as path from "path";
import { TestScenario } from "../../TestScenario";
import * as Constants from '../../utils/Constants';
import { FileHelper } from "../../utils/FileHelper";

export class OldReporterEngine implements IReporter {
    createReport(scenario: TestScenario): void {
        this.saveExecutionDevicesList(scenario);
        this.createFolderStructure(scenario);
    }

    saveReport(scenario: TestScenario): void {
        this.generateGeneralReport(scenario);
    }

    private saveExecutionDevicesList(scenario: TestScenario): void {
        const path = `${Constants.REPORT_PATH}/${scenario.executionId}/${Constants.DEVICES_REPORT_FILE_NAME}`;
        FileHelper.instance().createFileIfDoesNotExist(path);
        FileHelper.instance().appendTextToFile(
            JSON.stringify(this.devicesHash(scenario.devices)),
            path
        );
    }

    private createFolderStructure(scenario: TestScenario): void {
        const base = `${Constants.REPORT_PATH}/${scenario.executionId}`;
        FileHelper.instance().createFolderIfDoesNotExist(base);
        FileHelper.instance().createFolderIfDoesNotExist(`${base}/assets`);
        FileHelper.instance().createFolderIfDoesNotExist(`${base}/assets/js`);
    }

    private generateGeneralReport(scenario: TestScenario): void {
        const devicesReport = this.reportByDevices(scenario);
        const featuresReport = this.featuresFromReportByDevices(devicesReport);
        const dataHash = this.featureByNodesAndLinks(featuresReport);

        const dataPath = `${Constants.REPORT_PATH}/${scenario.executionId}/assets/js/${Constants.D3_DATA_FILE_NAME}`;
        FileHelper.instance().createFileIfDoesNotExist(dataPath);
        FileHelper.instance().appendTextToFile(JSON.stringify(dataHash), dataPath);

        const data = {
            devices: this.devicesHash(scenario.devices),
            featuresReport
        };

        const templatePath = path.resolve(__dirname, "../../reporter/index.html.ejs");
        const template = FileHelper.instance().contentOfFile(templatePath);
        const html = ejs.render(template, data);

        const reportFilePath = `${Constants.REPORT_PATH}/${scenario.executionId}/index.html`;
        FileHelper.instance().createFileIfDoesNotExist(reportFilePath);
        FileHelper.instance().appendTextToFile(html, reportFilePath);
    }

    private devicesHash(devices: any[]): any[] {
        return devices
            .filter((device) => device != null && device != undefined)
            .map((device, index) => {
                const screenSize = device.screenSize();
                return {
                    user: index + 1,
                    id: device.id,
                    model: device.model,
                    sdk: device.sdkVersion(),
                    type: device.constructor.name,
                    screen_width: screenSize.width,
                    screen_height: screenSize.height
                };
            });
    }

    private reportByDevices(scenario: TestScenario): any {
        let devicesReport: any = {};
        const devices = this.devicesHash(scenario.devices);

        devices.forEach((device: any) => {
            const deviceReportFilePath = `${Constants.REPORT_PATH}/${scenario.executionId}/${device.id}/${Constants.FILE_REPORT_NAME}`;

            if (!FileHelper.instance().pathExists(deviceReportFilePath)) {
                return;
            }

            const fileContent = FileHelper.instance().contentOfFile(deviceReportFilePath);
            devicesReport[device.user] = JSON.parse(fileContent);

            devicesReport[device.user].forEach((entry: any) => {
                if (entry.device_model == null || entry.device_model == undefined) {
                    entry.device_model = device.model;
                }

                if (entry.device_id == null || entry.device_id == undefined) {
                    entry.device_id = device.id;
                }
            });
        });

        return devicesReport;
    }
}
