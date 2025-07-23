import * as fs from "fs";
import * as path from "path";
import { IStorage } from "./IStorage";
import { TestScenario } from "../../TestScenario";

export class FileSystemStorage implements IStorage {
    private basePath = path.resolve("./reports");

    save(content: string, options: { destination: string }): void {
        const fullPath = path.resolve("./reports", options.destination);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
    }

    saveDeviceList(scenario: TestScenario): void {
        const devicePath = path.resolve("./reports", scenario.executionId, "devices.json");
        const devices = scenario.devices.map((device, index) => ({
            user: index + 1,
            id: device.id,
            model: device.model,
            sdk: device.sdkVersion(),
            type: device.constructor.name,
            screen_width: device.screenSize().width,
            screen_height: device.screenSize().height,
        }));

        fs.mkdirSync(path.dirname(devicePath), { recursive: true });
        fs.writeFileSync(devicePath, JSON.stringify(devices, null, 2));
    }

    getPath(options: { destination: string }): string {
        return path.resolve(this.basePath, options.destination);
    }
}
