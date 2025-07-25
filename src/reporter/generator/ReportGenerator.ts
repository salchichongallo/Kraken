import { TestScenario } from "../../TestScenario";
import { IStorage } from "../storage/IStorage";
import { ReportData } from "./ReportData";
import * as path from "path";
import * as fs from "fs";
import * as ejs from "ejs";

export class ReportGenerator {
    generateConsolidatedData(scenario: TestScenario): ReportData {
        const metrics = this.aggregateMetrics(scenario);
        const devices = this.generateDevicesJson(scenario);
        const featuresReport = this.generateReportJson(scenario);
        const graph = this.generateDataJson(featuresReport);

        return { metrics, devices, featuresReport, graph };
    }

    private aggregateMetrics(scenario: TestScenario): any {
        const totalDevices = scenario.devices.filter(Boolean).length;
        const totalScenarios = scenario.featureFile.scenarios.length;

        const passedScenarios = scenario.featureFile.scenarios.filter((s) =>
            s.tags.includes("@passed")
        ).length;

        const failedScenarios = totalScenarios - passedScenarios;

        return {
            totalDevices,
            totalScenarios,
            passedScenarios,
            failedScenarios,
        };
    }

    generateDevicesJson(scenario: TestScenario): any[] {
        return scenario.devices
            .filter((device) => !!device)
            .map((device, i) => {
                const screen = device.screenSize?.() ?? { width: "--", height: "--" };
                return {
                    id: device.id,
                    sdk: device.sdkVersion?.(),
                    model: device.model,
                    screen_height: screen.height,
                    screen_width: screen.width,
                    type: device.constructor.name,
                };
            });
    }

    private generateReportJson(scenario: TestScenario): any {
        const report: any = {};

        scenario.featureFile.scenarios.forEach((feature, index) => {
            const featureId = feature.tags.find((tag) => tag.startsWith("@id"))?.replace("@id:", `feature-${index}`) || `feature-${index}`;

            const deviceId = this.extractDeviceId(feature.tags);
            const device = scenario.devices[deviceId];
            const device_model = device?.model ?? "Unknown";

            if (!device) return;

            report[featureId] = report[featureId] || {
                name: feature.name,
                devices: {},
            };

            report[featureId].devices[device.id] = (report[featureId].devices[device.id] || []).concat([
                {
                    name: "Given some step",
                    duration: 1000000,
                    image: null,
                    device_model,
                    status: feature.tags.includes("@passed") ? "passed" : "failed",
                },
            ]);
        });

        return report;
    }

    private generateDataJson(report: any): any[] {
        const sankeyList: any[] = [];

        Object.keys(report).forEach((featureId) => {
            const feature = report[featureId];
            const nodesSet = new Set();
            const links: any[] = [];

            Object.entries(feature.devices || {}).forEach(([deviceId, steps]: any) => {
                steps.forEach((step: any, idx: number) => {
                    const fromNode = idx === 0 ? "Start" : `${featureId}-step-${idx - 1}`;
                    const toNode = `${featureId}-step-${idx}`;

                    nodesSet.add(fromNode);
                    nodesSet.add(toNode);

                    links.push({
                        source: fromNode,
                        target: toNode,
                        owner: deviceId,
                        owner_model: step.device_model,
                        status: step.status,
                    });
                });
            });

            const nodes = Array.from(nodesSet).map((id) => ({
                id,
                label: id,
                status: id === "Start" ? "passed" : undefined,
            }));

            sankeyList.push({
                name: feature.name,
                nodes,
                links,
            });
        });

        return sankeyList;
    }

    generateDeviceFeatureReport(scenario: TestScenario): Record<string, string> {
        const featuresReport = this.generateReportJson(scenario);
        const htmlByDevice: Record<string, string> = {};

        for (const featureId of Object.keys(featuresReport)) {
            const feature = featuresReport[featureId];

            for (const deviceId of Object.keys(feature.devices)) {
                if (!htmlByDevice[deviceId]) {
                    htmlByDevice[deviceId] = "";
                }

                const steps = feature.devices[deviceId];
                htmlByDevice[deviceId] += `<h2>${feature.name}</h2><pre>${JSON.stringify(steps, null, 2)}</pre>`;
            }
        }

        return htmlByDevice;
    }

    generateFeatureReports(scenario: TestScenario, storage: any) {
        const features = scenario.featureFile.scenarios;

        // Enriquecer cada feature con metadatos adicionales
        const featuresData = features.map((feature, index) => {
            const deviceId = this.extractDeviceId(feature.tags);
            const device = scenario.devices[deviceId] ?? {
                model: "Unknown",
                id: "unknown",
                constructor: { name: "UnknownDevice" },
            };

            // Aquí tú defines artificialmente los pasos, porque no existen en feature
            const steps = [
                {
                    keyword: "Given",
                    name: "some step",
                    result: {
                        status: feature.tags.includes("@passed") ? "passed" : "failed",
                        duration: 1000000, // puedes ajustar con duración real si la tienes
                    },
                },
            ];

            const passed = steps.every((step: any) => step.result.status === "passed");

            return {
                ...feature,
                _device: device,
                _featureId: `feature-${index}`,
                _status: passed ? "passed" : "failed",
                _duration: steps.reduce((acc: number, step: any) => acc + step.result.duration, 0),
                elements: [{
                    name: feature.name,
                    steps,
                }],
            };
        });


        // Agrupar features por dispositivo
        const featuresByDevice: Record<string, any[]> = {};
        for (const feature of featuresData) {
            const deviceId = feature._device.id;
            if (!featuresByDevice[deviceId]) {
                featuresByDevice[deviceId] = [];
            }
            featuresByDevice[deviceId].push(feature);
        }

        // Leer la plantilla
        const templatePath = path.resolve(__dirname, "../../../reporter/feature_report.html.ejs");
        const template = fs.readFileSync(templatePath, "utf-8");

        const basePath = `${scenario.executionId}`;
        storage.ensureFolder(basePath);

        // Generar un feature_report.html por cada device
        for (const [deviceId, features] of Object.entries(featuresByDevice)) {
            const passed = features.filter(f => f._status === "passed");
            const failed = features.filter(f => f._status === "failed");

            const html = ejs.render(template, {
                features,
                total_features: features.length,
                total_scenarios: features.length,
                total_passed_features: passed.length,
                total_failed_features: failed.length,
                total_passed_scenarios: passed.length,
                total_failed_scenarios: failed.length,
                total_passed_features_percentage: ((passed.length / features.length) * 100).toFixed(2),
                total_failed_features_percentage: ((failed.length / features.length) * 100).toFixed(2),
                total_passed_scenarios_percentage: ((passed.length / features.length) * 100).toFixed(2),
                total_failed_scenarios_percentage: ((failed.length / features.length) * 100).toFixed(2),
                apk_path: "--",
                featureId: (feature: any) => feature._featureId,
                feature_passed: (feature: any) => feature._status === "passed",
                feature_duration: (feature: any) => feature._duration,
                passed_scenarios: (feature: any) => feature._status === "passed" ? [feature] : [],
                failed_scenarios: (feature: any) => feature._status === "failed" ? [feature] : [],
                format_duration: (ms: number) => `${(ms / 1000).toFixed(2)}s`,
                device: features[0]._device,
            });

            const devicePath = `${basePath}/${deviceId}`;
            storage.ensureFolder(devicePath);

            storage.save(html, {
                destination: `${devicePath}/feature_report.html`,
            });
        }
    }

    extractDeviceId(tags: string[]): number {
        const userTag = tags.find((t) => t.startsWith("@user"));
        return userTag ? parseInt(userTag.replace("@user", "")) - 1 : 0;
    }

    generateScenarioReports(scenario: TestScenario, storage: any) {
        const features = scenario.featureFile.scenarios;

        const templatePath = path.resolve(
            __dirname,
            "../../../reporter/scenario_report.html.ejs"
        );
        const template = fs.readFileSync(templatePath, "utf-8");

        features.forEach((feature, index) => {
            const deviceId = this.extractDeviceId(feature.tags);
            const device = scenario.devices[deviceId] ?? {
                model: "Unknown",
                id: "unknown",
                constructor: { name: "UnknownDevice" },
            };

            const enrichedFeature = {
                ...feature,
                elements: [
                    {
                        name: feature.name,
                        steps: [], // Vacío porque FeatureScenario no tiene steps
                    },
                ],
            };

            const basePath = `${scenario.executionId}/${device.id}/features_report`;
            storage.ensureFolder(basePath);

            const html = ejs.render(template, {
                feature: enrichedFeature,
                apk_path: "--",
                featureId: `feature-${index}`,
                feature_passed: (f: any) => f.tags.includes("@passed"),
                feature_duration: () => "1.23s",
                passed_scenarios: (f: any) => f.tags.includes("@passed") ? [f] : [],
                failed_scenarios: (f: any) => f.tags.includes("@passed") ? [] : [f],
                passedScenarios: (f: any) => f.tags.includes("@passed") ? [f] : [],
                failedScenarios: (f: any) => f.tags.includes("@passed") ? [] : [f],
                format_duration: (ms: number) => `${(ms / 1000).toFixed(2)}s`,
                featurePassedScenariosPercentage: (f: any) => f.tags.includes("@passed") ? 100 : 0,
                featureFailedScenariosPercentage: (f: any) => f.tags.includes("@passed") ? 0 : 100,
                device,
            });

            storage.save(html, {
                destination: `${basePath}/feature-${index}.html`,
            });
        });
    }


}
