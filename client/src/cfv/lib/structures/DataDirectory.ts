import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["I", "VirtualAddress"],
    ["I", "Size"],
];

export const DIRECTORY_ENTRY = {
    IMAGE_DIRECTORY_ENTRY_EXPORT: 0,
    IMAGE_DIRECTORY_ENTRY_IMPORT: 1,
    IMAGE_DIRECTORY_ENTRY_RESOURCE: 2,
    IMAGE_DIRECTORY_ENTRY_EXCEPTION: 3,
    IMAGE_DIRECTORY_ENTRY_SECURITY: 4,
    IMAGE_DIRECTORY_ENTRY_BASERELOC: 5,
    IMAGE_DIRECTORY_ENTRY_DEBUG: 6,
    IMAGE_DIRECTORY_ENTRY_COPYRIGHT: 7,
    IMAGE_DIRECTORY_ENTRY_GLOBALPTR: 8,
    IMAGE_DIRECTORY_ENTRY_TLS: 9,
    IMAGE_DIRECTORY_ENTRY_LOAD_CONFIG: 10,
    IMAGE_DIRECTORY_ENTRY_BOUND_IMPORT: 11,
    IMAGE_DIRECTORY_ENTRY_IAT: 12,
    IMAGE_DIRECTORY_ENTRY_DELAY_IMPORT: 13,
    IMAGE_DIRECTORY_ENTRY_COM_DESCRIPTOR: 14,
    IMAGE_DIRECTORY_ENTRY_RESERVED: 15,
};

export class DataDirectory extends Structure {
    public VirtualAddress = 0;
    public Size = 0;
    public name = "";

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
