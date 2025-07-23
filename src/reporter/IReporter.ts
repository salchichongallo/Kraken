import { TestScenario } from "../TestScenario";

export interface IReporter {
  createReport(scenario: TestScenario): void;
  saveReport(scenario: TestScenario): void;
}
