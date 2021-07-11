import { OptionalHeader } from "./OptionalHeader";
import { FileHeader } from "./FileHeader";
import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [["I", "Signature"]];

export class NTHeader extends Structure {
    public Signature = 0;
    FILE_HEADER?: FileHeader;
    OPTIONAL_HEADER?: OptionalHeader;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
