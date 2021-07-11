import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["H", "Length"],
    ["H", "ValueLength"],
    ["H", "Type"],
];

export class StringTable extends Structure {
    public Length = 0;
    public ValueLength = 0;
    public Type = 0;
    public LangID = "";
    public entries: { [key: string]: string } = {};
    public entriesOffsets: { [key: string]: number[] } = {};
    public entriesLengths: { [key: string]: number[] } = {};

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
