import { TestScenario } from "../../TestScenario";

export interface IStorage {
  save(content: string, options: { destination: string }): void;
  saveDeviceList(scenario: TestScenario): void;
  getPath(options: { destination: string }): string;
  ensureFolder(path: string): void;
}
