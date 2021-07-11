import { DataDirectory } from "./DataDirectory";
import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["H", "Magic"],
    ["B", "MajorLinkerVersion"],
    ["B", "MinorLinkerVersion"],
    ["I", "SizeOfCode"],
    ["I", "SizeOfInitializedData"],
    ["I", "SizeOfUninitializedData"],
    ["I", "AddressOfEntryPoint"],
    ["I", "BaseOfCode"],
    ["I", "BaseOfData"],
    ["I", "ImageBase"],
    ["I", "SectionAlignment"],
    ["I", "FileAlignment"],
    ["H", "MajorOperatingSystemVersion"],
    ["H", "MinorOperatingSystemVersion"],
    ["H", "MajorImageVersion"],
    ["H", "MinorImageVersion"],
    ["H", "MajorSubsystemVersion"],
    ["H", "MinorSubsystemVersion"],
    ["I", "Reserved1"],
    ["I", "SizeOfImage"],
    ["I", "SizeOfHeaders"],
    ["I", "CheckSum"],
    ["H", "Subsystem"],
    ["H", "DllCharacteristics"],
    ["I", "SizeOfStackReserve"],
    ["I", "SizeOfStackCommit"],
    ["I", "SizeOfHeapReserve"],
    ["I", "SizeOfHeapCommit"],
    ["I", "LoaderFlags"],
    ["I", "NumberOfRvaAndSizes"],
];
const FORMAT_x64: Format = [
    ["H", "Magic"],
    ["B", "MajorLinkerVersion"],
    ["B", "MinorLinkerVersion"],
    ["I", "SizeOfCode"],
    ["I", "SizeOfInitializedData"],
    ["I", "SizeOfUninitializedData"],
    ["I", "AddressOfEntryPoint"],
    ["I", "BaseOfCode"],
    ["T", "ImageBase"],
    ["I", "SectionAlignment"],
    ["I", "FileAlignment"],
    ["H", "MajorOperatingSystemVersion"],
    ["H", "MinorOperatingSystemVersion"],
    ["H", "MajorImageVersion"],
    ["H", "MinorImageVersion"],
    ["H", "MajorSubsystemVersion"],
    ["H", "MinorSubsystemVersion"],
    ["I", "Reserved1"],
    ["I", "SizeOfImage"],
    ["I", "SizeOfHeaders"],
    ["I", "CheckSum"],
    ["H", "Subsystem"],
    ["H", "DllCharacteristics"],
    ["T", "SizeOfStackReserve"],
    ["T", "SizeOfStackCommit"],
    ["T", "SizeOfHeapReserve"],
    ["T", "SizeOfHeapCommit"],
    ["I", "LoaderFlags"],
    ["I", "NumberOfRvaAndSizes"],
];

export class OptionalHeader extends Structure {
    public Magic = 0;
    public MajorLinkerVersion = 0;
    public MinorLinkerVersion = 0;
    public SizeOfCode = 0;
    public SizeOfInitializedData = 0;
    public SizeOfUninitializedData = 0;
    public AddressOfEntryPoint = 0;
    public BaseOfCode = 0;
    public BaseOfData = 0;
    public ImageBase = 0;
    public SectionAlignment = 0;
    public FileAlignment = 0;
    public MajorOperatingSystemVersion = 0;
    public MinorOperatingSystemVersion = 0;
    public MajorImageVersion = 0;
    public MinorImageVersion = 0;
    public MajorSubsystemVersion = 0;
    public MinorSubsystemVersion = 0;
    public Reserved1 = 0;
    public SizeOfImage = 0;
    public SizeOfHeaders = 0;
    public CheckSum = 0;
    public Subsystem = 0;
    public DllCharacteristics = 0;
    public SizeOfStackReserve = 0;
    public SizeOfStackCommit = 0;
    public SizeOfHeapReserve = 0;
    public SizeOfHeapCommit = 0;
    public LoaderFlags = 0;
    public NumberOfRvaAndSizes = 0;
    public DATA_DIRECTORY: DataDirectory[] = [];

    constructor(fileOffset: number, x64 = false) {
        super(x64 ? FORMAT_x64 : FORMAT, fileOffset);
    }
}
