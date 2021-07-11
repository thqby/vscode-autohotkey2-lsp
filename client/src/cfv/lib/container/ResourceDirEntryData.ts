import { UnicodeStringWrapperPostProcessor } from "../UnicodeStringWrapperPostProcessor";
import { ResourceDataEntryData } from "./ResourceDataEntryData";
import { ResourceEntry } from "../structures/ResourceEntry";
import { ResourceDirData } from "./ResourceDirData";

export class ResourceDirEntryData {
    public struct: ResourceEntry;
    public name: UnicodeStringWrapperPostProcessor | undefined;
    public id: number | undefined;
    public data: ResourceDataEntryData | undefined;
    public directory: ResourceDirData | undefined;

    constructor(
        struct: ResourceEntry,
        name: UnicodeStringWrapperPostProcessor | undefined,
        id: number | undefined,
        dataOrDirectory: ResourceDataEntryData | ResourceDirData
    ) {
        this.struct = struct;
        this.name = name;
        this.id = id;

        if (dataOrDirectory instanceof ResourceDirData) this.directory = dataOrDirectory;
        else this.data = dataOrDirectory;
    }
}
