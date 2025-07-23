import { TestScenario } from "../../TestScenario";
import { ReportData } from "./ReportData";

export class ReportGenerator {
    generateConsolidatedData(scenario: TestScenario): ReportData {
        const metrics = this.aggregateMetrics(scenario);
        const graph = this.buildSignalGraph(scenario);
        return { metrics, graph };
    }

    private aggregateMetrics(scenario: TestScenario): any {
        const totalDevices = scenario.devices.length;
        const totalScenarios = scenario.featureFile.scenarios.length;

        const passedScenarios = scenario.featureFile.scenarios.filter(
            (s) => s.tags.includes("@passed")
        ).length;

        const failedScenarios = totalScenarios - passedScenarios;

        return {
            totalDevices,
            totalScenarios,
            passedScenarios,
            failedScenarios
        };
    }

    private buildSignalGraph(scenario: TestScenario): any {
        const nodes: any[] = [];
        const links: any[] = [];

        scenario.devices.forEach((device, index) => {
            nodes.push({
                id: `device-${device.id}`,
                label: `Device ${index + 1}`,
                type: "device"
            });
        });

        scenario.featureFile.scenarios.forEach((featureScenario, index) => {
            const scenarioId = `scenario-${index}`;
            nodes.push({
                id: scenarioId,
                label: featureScenario.name,
                type: "scenario"
            });

            const userTag = featureScenario.tags.find(tag => tag.startsWith("@user"));
            if (userTag) {
                const userId = parseInt(userTag.replace("@user", ""));
                const device = scenario.devices[userId - 1];
                if (device) {
                    links.push({
                        source: scenarioId,
                        target: `device-${device.id}`,
                        type: "executed_on"
                    });
                }
            }
        });

        return { nodes, links };
    }

}
