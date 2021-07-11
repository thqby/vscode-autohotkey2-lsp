import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["I", "Name"],
    ["I", "OffsetToData"],
];

export const RESOURCE_TYPE = {
    RT_CURSOR: 1,
    RT_BITMAP: 2,
    RT_ICON: 3,
    RT_MENU: 4,
    RT_DIALOG: 5,
    RT_STRING: 6,
    RT_FONTDIR: 7,
    RT_FONT: 8,
    RT_ACCELERATOR: 9,
    RT_RCDATA: 10,
    RT_MESSAGETABLE: 11,
    RT_GROUP_CURSOR: 12,
    RT_GROUP_ICON: 14,
    RT_VERSION: 16,
    RT_DLGINCLUDE: 17,
    RT_PLUGPLAY: 19,
    RT_VXD: 20,
    RT_ANICURSOR: 21,
    RT_ANIICON: 22,
    RT_HTML: 23,
    RT_MANIFEST: 24,
};

export class ResourceEntry extends Structure {
    public Name = 0;
    public OffsetToData = 0;
    public NameOffset = 0;
    public pad = 0;
    public Id = 0;
    public DataIsDirectory = false;
    public OffsetToDirectory = 0;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
