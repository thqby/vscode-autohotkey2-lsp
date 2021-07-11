import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["H", "Length"],
    ["H", "ValueLength"],
    ["H", "Type"],
];

export class VersionInfo extends Structure {
    public Length = 0;
    public ValueLength = 0;
    public Type = 0;
    public Key = "";

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
