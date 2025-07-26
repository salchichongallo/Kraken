import { TestScenario } from "../../TestScenario";
import { IStorage } from "../storage/IStorage";
import { ReportData } from "./ReportData";
import * as path from "path";
import * as fs from "fs";
import * as ejs from "ejs";

export class ReportGenerator {
    PASSED = 'passed'
    FAILED = 'failed'

    generateConsolidatedData(scenario: TestScenario): ReportData {
        const reportJson: Record<string, any> = {};

        for (const device of scenario.devices) {
            if (!device) continue;

            const deviceReportPath = path.resolve(`reports/${scenario.executionId}/${device.id}/report.json`);
            if (!fs.existsSync(deviceReportPath)) continue;

            const deviceReport = JSON.parse(fs.readFileSync(deviceReportPath, "utf-8"));

            for (const feature of deviceReport) {
                const featureId = feature.id || feature.name;
                if (!reportJson[featureId]) {
                    reportJson[featureId] = {
                        name: feature.name,
                        elements: [],
                    };
                }

                feature.elements?.forEach((element: any) => {
                    const enrichedElement = {
                        ...element,
                        steps: element.steps?.map((step: any) => ({
                            ...step,
                            device_model: device.model,
                        })) || [],
                    };
                    reportJson[featureId].elements.push(enrichedElement);
                });
            }
        }

        const metrics = this.aggregateMetrics(scenario, reportJson);
        const devices = this.generateDevicesJson(scenario);
        const featuresReport = this.generateReportJson(scenario, reportJson);
        const graph = this.generateDataJson(featuresReport);

        return { metrics, devices, featuresReport, graph };
    }

    private aggregateMetrics(scenario: TestScenario, reportJson: Record<string, any>): any {
        const totalDevices = scenario.devices.filter(Boolean).length;

        let totalScenarios = 0;
        let passedScenarios = 0;
        let failedScenarios = 0;

        Object.values(reportJson).forEach((feature: any) => {
            feature.elements?.forEach((scenario: any) => {
                totalScenarios++;
                const allPassed = scenario.steps?.every((step: any) => step.result?.status === this.PASSED);
                if (allPassed) passedScenarios++;
                else failedScenarios++;
            });
        });

        return { totalDevices, totalScenarios, passedScenarios, failedScenarios };
    }

    generateDevicesJson(scenario: TestScenario): any[] {
        return scenario.devices
            .filter((device) => !!device)
            .map((device) => {
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

    private generateReportJson(scenario: TestScenario, reportJson: Record<string, any>): any {
        const report: any = {};

        scenario.featureFile.scenarios.forEach((feature, index) => {
            const featureId = feature.tags.find((tag) => tag.startsWith("@id"))?.replace("@id:", `feature-${index}`) || `feature-${index}`;
            const deviceId = this.extractDeviceId(feature.tags);
            const device = scenario.devices[deviceId];
            const device_model = device?.model ?? "Unknown";
            if (!device) return;

            const matchingFeatureFromReport = Object.values(reportJson).find((f: any) =>
                f.elements.some((e: any) => e.name === feature.name)
            );
            if (!matchingFeatureFromReport) return;

            const steps = matchingFeatureFromReport.elements.find((e: any) => e.name === feature.name)?.steps || [];
            const stepsNormalized = steps.map((step: any) => ({
                name: step.name || "(unknown)",
                keyword: step.keyword?.trim() ?? "",
                duration: step.result?.duration ?? 0,
                status: step.result?.status ?? "unknown",
                image: step.embeddings?.[0]?.data ?? null,
                device_model,
            }));

            report[featureId] = report[featureId] || {
                name: feature.name,
                devices: {},
            };
            report[featureId].devices[device.id] = stepsNormalized;
        });

        return report;
    }

    private generateDataJson(report: any): any[] {
        const sankeyList: any[] = [];

        Object.entries(report).forEach(([featureId, feature]: any) => {
            const nodesSet = new Set<string>();
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
                        owner_model: step.device_model ?? "Unknown",
                        status: step.status ?? "unknown",
                    });
                });
            });

            const nodes = Array.from(nodesSet).map((id) => ({ id, label: id, status: id === "Start" ? this.PASSED : undefined }));
            sankeyList.push({ name: feature.name, nodes, links });
        });

        return sankeyList;
    }

    extractDeviceId(tags: string[]): number {
        const userTag = tags.find((t) => t.startsWith("@user"));
        return userTag ? parseInt(userTag.replace("@user", "")) - 1 : 0;
    }

    generateFeatureReports(scenario: TestScenario, storage: IStorage) {
        const templatePath = path.resolve(__dirname, "../../../reporter/feature_report.html.ejs");
        const template = fs.readFileSync(templatePath, "utf-8");
        const reportData = this.generateConsolidatedData(scenario).featuresReport;

        const basePath = `${scenario.executionId}`;
        storage.ensureFolder(basePath);

        Object.entries(reportData).forEach(([featureId, feature]: any) => {
            Object.entries(feature.devices).forEach(([deviceId, steps]: any) => {
                const device = scenario.devices.find((d) => d?.id === deviceId) ?? {
                    model: "Unknown",
                    id: deviceId,
                    constructor: { name: "UnknownDevice" },
                };

                const enrichedFeature = {
                    name: feature.name,
                    _featureId: featureId,
                    _device: device,
                    _status: steps.every((s: any) => s.status === this.PASSED) ? this.PASSED : this.FAILED,
                    _duration: steps.reduce((acc: number, s: any) => acc + (s.duration ?? 0), 0),
                    elements: [{
                        name: feature.name,
                        steps: steps.map((s: any) => ({
                            keyword: s.keyword ?? "Step",
                            name: s.name,
                            result: {
                                status: s.status,
                                duration: s.duration
                            },
                            embeddings: s.image ? [{ data: s.image }] : [],
                        })),
                    }],
                };

                const totalScenarios = enrichedFeature.elements.length;
                const passedScenarios = enrichedFeature.elements.filter(e =>
                    e.steps.every((s: any) => s.result.status === this.PASSED)
                ).length;
                const failedScenarios = totalScenarios - passedScenarios;

                const html = ejs.render(template, {
                    features: [enrichedFeature],
                    total_features: 1,
                    total_scenarios: totalScenarios,
                    total_passed_features: enrichedFeature._status === this.PASSED ? 1 : 0,
                    total_failed_features: enrichedFeature._status === this.FAILED ? 1 : 0,
                    total_passed_scenarios: passedScenarios,
                    total_failed_scenarios: failedScenarios,
                    total_passed_features_percentage: enrichedFeature._status === this.PASSED ? "100.00" : "0.00",
                    total_failed_features_percentage: enrichedFeature._status === this.FAILED ? "100.00" : "0.00",
                    total_passed_scenarios_percentage: ((passedScenarios / totalScenarios) * 100).toFixed(2),
                    total_failed_scenarios_percentage: ((failedScenarios / totalScenarios) * 100).toFixed(2),
                    apk_path: "--",
                    featureId: (f: any) => f._featureId,
                    feature_passed: (f: any) => f._status === this.PASSED,
                    feature_duration: (f: any) => f._duration,
                    passed_scenarios: (f: any) => f._status === this.PASSED ? [f] : [],
                    failed_scenarios: (f: any) => f._status === this.FAILED ? [f] : [],
                    format_duration: (ms: number) => `${(ms / 1000).toFixed(2)}s`,
                    device,
                    PASSED: this.PASSED
                });

                const devicePath = `${basePath}/${deviceId}`;
                storage.ensureFolder(devicePath);

                storage.save(html, {
                    destination: `${devicePath}/feature_report.html`,
                });
            });
        });
    }


    generateScenarioReports(scenario: TestScenario, storage: IStorage) {
        const templatePath = path.resolve(__dirname, "../../../reporter/scenario_report.html.ejs");
        const template = fs.readFileSync(templatePath, "utf-8");
        const reportData = this.generateConsolidatedData(scenario).featuresReport;

        Object.entries(reportData).forEach(([featureId, feature]: any) => {
            Object.entries(feature.devices).forEach(([deviceId, steps]: any) => {
                const passed = steps.every((s: any) => s.status === this.PASSED);

                const enrichedFeature = {
                    name: feature.name,
                    tags: passed ? ["@passed"] : ["@failed"],
                    elements: [{
                        name: feature.name,
                        steps: steps.map((s: any) => ({
                            keyword: s.keyword ?? "Step",
                            name: s.name,
                            result: { status: s.status, duration: s.duration },
                            embeddings: s.image ? [{ data: s.image }] : [],
                        })),
                    }],
                };

                const basePath = `${scenario.executionId}/${deviceId}/features_report`;
                storage.ensureFolder(basePath);

                const html = ejs.render(template, {
                    feature: enrichedFeature,
                    apk_path: "--",
                    featureId,
                    feature_passed: (f: any) => f.tags.includes("@passed"),
                    feature_duration: () => `${(steps.reduce((acc: number, s: any) => acc + (s.duration ?? 0), 0) / 1000).toFixed(2)}s`,
                    passed_scenarios: (f: any) => f.tags.includes("@passed") ? [f] : [],
                    failed_scenarios: (f: any) => f.tags.includes("@passed") ? [] : [f],
                    passedScenarios: (f: any) => f.tags.includes("@passed") ? [f] : [],
                    failedScenarios: (f: any) => f.tags.includes("@passed") ? [] : [f],
                    format_duration: (ms: number) => `${(ms / 1000).toFixed(2)}s`,
                    featurePassedScenariosPercentage: (f: any) => f.tags.includes("@passed") ? 100 : 0,
                    featureFailedScenariosPercentage: (f: any) => f.tags.includes("@passed") ? 0 : 100,
                    device: scenario.devices.find((d) => d?.id === deviceId) ?? {
                        model: "Unknown",
                        id: deviceId,
                        constructor: { name: "UnknownDevice" },
                    },
                });

                storage.save(html, {
                    destination: `${basePath}/${featureId}.html`,
                });
            });
        });
    }
}
