import { ResourceDataEntry } from "../structures/ResourceDataEntry";

export class ResourceDataEntryData {
    public struct: ResourceDataEntry;
    public lang: number;
    public subLang: number;

    constructor(struct: ResourceDataEntry, lang: number, subLang: number) {
        this.struct = struct;
        this.lang = lang;
        this.subLang = subLang;
    }
}
