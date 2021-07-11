import { ResourceDirectory } from "../structures/ResourceDirectory";
import { ResourceDirEntryData } from "./ResourceDirEntryData";

export class ResourceDirData {
    public struct: ResourceDirectory;
    public entries: ResourceDirEntryData[];

    constructor(struct: ResourceDirectory, entries: ResourceDirEntryData[]) {
        this.struct = struct;
        this.entries = entries;
    }
}
