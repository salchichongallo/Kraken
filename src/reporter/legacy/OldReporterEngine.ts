import { IReporter } from "../IReporter";
import * as ejs from "ejs";
import * as path from "path";
import { TestScenario } from "../../TestScenario";
import * as Constants from '../../utils/Constants';
import { FileHelper } from "../../utils/FileHelper";

export class OldReporterEngine implements IReporter {
    private readonly PASSED = 'passed';
    private readonly FAILED = 'failed';

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
        const featuresReport = this.feturesFromReportByDevices(devicesReport);
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

    private feturesFromReportByDevices(reportByDevices: any) {
        let features: any = {}
        Object.keys(reportByDevices).forEach((key: any) => {
            let report = reportByDevices[key];
            report.forEach((feature: any) => {
                if (features[feature.id] == null || features[feature.id] == undefined) {
                    features[feature.id] = {}
                }

                if ((features[feature.id].name == null || features[feature.id].name == undefined) && feature.name) {
                    features[feature.id].name = feature.name
                }

                if (features[feature.id].devices == null || features[feature.id].devices == undefined) {
                    features[feature.id].devices = {}
                }

                if (feature.elements && feature.elements.length > 0) {
                    features[feature.id].devices[key] = []
                    if (feature.elements[0].steps != null || feature.elements[0].steps != undefined) {
                        let failed = false
                        feature.elements[0].steps.forEach((step: any) => {
                            if (failed) { return; }

                            failed = step.result.status != this.PASSED
                            let image = null;
                            if (step.embeddings != null && step.embeddings != undefined && step.embeddings.length > 0) {
                                image = step.embeddings[0].data
                            }
                            features[feature.id].devices[key].push({
                                name: `${step.keyword} ${step.name || ''}`,
                                duration: step.result.duration,
                                image: image,
                                device_model: feature.device_model,
                                status: failed ? this.FAILED : this.PASSED
                            });
                        });
                    }
                }
            });
        });
        return features;
    }

    private featureByNodesAndLinks(reportByDevices: any): any {
        let features: any = [];
        Object.keys(reportByDevices).forEach((key: any) => {
            let feature = reportByDevices[key];
            if (feature.devices != null && feature.devices != undefined) {
                features.push(
                    this.nodesAndLinks(feature.devices, feature.name)
                );
            }
        });
        return features;
    }

    private nodesAndLinks(featureReport: any, featureName: any): any {
        let lastNodeId = 0;
        let nodes = [{ name: "", id: "empty", image: null }];
        let signalHash: any = {};
        let links: any = [];
        Object.keys(featureReport).forEach((key: any) => {
            let steps = featureReport[key];
            let comingFromSignal = false;
            let lastSignal = -1;
            steps.forEach((step: any, index: number) => {
                let nodeId = lastNodeId + 1;

                if (this.isReadSignal(step.name) && step.status == this.PASSED) {
                    let signal = this.signalContent(step.name);
                    let alreadyCreatedSignal = signalHash[signal] ? true : false
                    signalHash[signal] = alreadyCreatedSignal ? signalHash[signal] : { id: `${nodeId}`, receiver: key }
                    let node = {
                        name: `Signal: ${signal}, Receiver: ${step.device_model}`,
                        id: signalHash[signal].id, image: null, status: step.status
                    }
                    if (alreadyCreatedSignal) {
                        let entry = nodes.filter((node: any) => {
                            return node.id == signalHash[signal].id
                        })[0];
                        if (entry != null || entry != undefined) {
                            entry.name = `Signal: ${signal}, Receiver: ${step.device_model}`
                        }
                    }
                    let source = (comingFromSignal ? lastSignal : (index == 0 ? 0 : lastNodeId))
                    let link = {
                        source: source,
                        target: parseInt(signalHash[signal].id),
                        value: 1,
                        owner: key,
                        owner_model: step.device_model
                    }
                    if (!alreadyCreatedSignal) {
                        nodes.push(node);
                        lastNodeId += 1;
                    }
                    links.push(link);
                    lastSignal = parseInt(signalHash[signal].id)
                    comingFromSignal = true
                } else if (this.isWriteSignal(step.name) && step.status == this.PASSED) {
                    let signal = this.signalContent(step.name);
                    let receiver = this.signalReceiver(step.name);
                    let alreadyCreatedSignal = signalHash[signal] ? true : false
                    signalHash[signal] = alreadyCreatedSignal ? signalHash[signal] : { id: `${nodeId}`, receiver: receiver }
                    let node = {
                        name: step.name, id: signalHash[signal].id,
                        image: null, status: step.status
                    }
                    let source = (comingFromSignal ? lastSignal : (index == 0 ? 0 : lastNodeId))
                    let link = {
                        source: source,
                        target: parseInt(signalHash[signal].id),
                        value: 1,
                        owner: key,
                        owner_model: step.device_model
                    }
                    if (!alreadyCreatedSignal) {
                        nodes.push(node);
                        lastNodeId += 1;
                    }
                    links.push(link);
                    lastSignal = parseInt(signalHash[signal].id)
                    comingFromSignal = true
                } else {
                    let node = {
                        name: step.name, id: `${nodeId}`,
                        image: step.image, status: step.status
                    }
                    let source = (comingFromSignal ? lastSignal : (index == 0 ? 0 : lastNodeId))
                    let link = {
                        source: source,
                        target: nodeId,
                        value: 1,
                        owner: key,
                        owner_model: step.device_model
                    }
                    nodes.push(node);
                    links.push(link);
                    lastNodeId += 1;
                    comingFromSignal = false
                }
            });
        });
        return {
            name: featureName,
            nodes: nodes,
            links: links
        };
    }

    private isReadSignal(step: String): boolean {
        return step.toLowerCase().indexOf("i send a signal to user") != -1;
    }

    private isWriteSignal(step: String): boolean {
        return step.toLowerCase().indexOf("i wait for a signal containing") != -1;
    }

    private signalContent(step: string): any {
        let found = step.match(/"([^\"]*)"/);
        if (found && found.length > 0) {
            return found[0].trim()
        }
        return null;
    }

    private signalReceiver(step: string): any {
        let found = step.match(/(\d+)/);
        if (found && found.length > 0) {
            return found[0].trim()
        }
        return null;
    }
}
