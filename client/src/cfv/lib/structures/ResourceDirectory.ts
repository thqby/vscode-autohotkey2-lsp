import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["I", "Characteristics"],
    ["I", "TimeDateStamp"],
    ["H", "MajorVersion"],
    ["H", "MinorVersion"],
    ["H", "NumberOfNamedEntries"],
    ["H", "NumberOfIdEntries"],
];

export class ResourceDirectory extends Structure {
    public Characteristics = 0;
    public TimeDateStamp = 0;
    public MajorVersion = 0;
    public MinorVersion = 0;
    public NumberOfNamedEntries = 0;
    public NumberOfIdEntries = 0;

    constructor(fileOffset = 0) {
        super(FORMAT, fileOffset);
    }
}
