import { Structure } from "../Structure";
import { Format } from "../Unpack";
import { StringTable } from "./StringTable";

const FORMAT: Format = [
    ["H", "Length"],
    ["H", "ValueLength"],
    ["H", "Type"],
];

export class StringFileInfo extends Structure {
    public Length = 0;
    public ValueLength = 0;
    public Type = 0;
    public StringTable: StringTable[] = [];
    public Key = "";

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
