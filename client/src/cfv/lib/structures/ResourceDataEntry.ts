import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["I", "OffsetToData"],
    ["I", "Size"],
    ["I", "CodePage"],
    ["I", "Reserved"],
];

export class ResourceDataEntry extends Structure {
    public OffsetToData = 0;
    public Size = 0;
    public CodePage = 0;
    public Reserved = 0;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
