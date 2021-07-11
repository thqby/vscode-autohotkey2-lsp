import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["H", "Length"],
    ["H", "ValueLength"],
    ["H", "Type"],
];

export class StringTableEntry extends Structure {
    public Length = 0;
    public ValueLength = 0;
    public Type = 0;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
