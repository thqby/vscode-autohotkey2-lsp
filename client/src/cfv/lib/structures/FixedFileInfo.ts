import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["I", "Signature"],
    ["I", "StructVersion"],
    ["I", "FileVersionMS"],
    ["I", "FileVersionLS"],
    ["I", "ProductVersionMS"],
    ["I", "ProductVersionLS"],
    ["I", "FileFlagsMask"],
    ["I", "FileFlags"],
    ["I", "FileOS"],
    ["I", "FileType"],
    ["I", "FileSubtype"],
    ["I", "FileDateMS"],
    ["I", "FileDateLS"],
];

export class FixedFileInfo extends Structure {
    public Signature = 0;
    public StructVersion = 0;
    public FileVersionMS = 0;
    public FileVersionLS = 0;
    public ProductVersionMS = 0;
    public ProductVersionLS = 0;
    public FileFlagsMask = 0;
    public FileFlags = 0;
    public FileOS = 0;
    public FileType = 0;
    public FileSubtype = 0;
    public FileDateMS = 0;
    public FileDateLS = 0;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
