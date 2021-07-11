import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["H", "Machine"],
    ["H", "NumberOfSections"],
    ["I", "TimeDateStamp"],
    ["I", "PointerToSymbolTable"],
    ["I", "NumberOfSymbols"],
    ["H", "SizeOfOptionalHeader"],
    ["H", "Characteristics"],
];

export class FileHeader extends Structure {
    public Machine = 0;
    public NumberOfSections = 0;
    public TimeDateStamp = 0;
    public PointerToSymbolTable = 0;
    public NumberOfSymbols = 0;
    public SizeOfOptionalHeader = 0;
    public Characteristics = 0;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
