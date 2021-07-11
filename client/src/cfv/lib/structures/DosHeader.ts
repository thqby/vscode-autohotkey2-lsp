import { Structure } from "../Structure";
import { Format } from "../Unpack";

const FORMAT: Format = [
    ["H", "e_magic"],
    ["H", "e_cblp"],
    ["H", "e_cp"],
    ["H", "e_crlc"],
    ["H", "e_cparhdr"],
    ["H", "e_minalloc"],
    ["H", "e_maxalloc"],
    ["H", "e_ss"],
    ["H", "e_sp"],
    ["H", "e_csum"],
    ["H", "e_ip"],
    ["H", "e_cs"],
    ["H", "e_lfarlc"],
    ["H", "e_ovno"],
    ["8s", "e_res"],
    ["H", "e_oemid"],
    ["H", "e_oeminfo"],
    ["20s", "e_res2"],
    ["I", "e_lfanew"],
];

export class DosHeader extends Structure {
    public e_magic = 0;
    public e_crlc = 0;
    public e_cparhdr = 0;
    public e_minalloc = 0;
    public e_maxalloc = 0;
    public e_ss = 0;
    public e_sp = 0;
    public e_csum = 0;
    public e_ip = 0;
    public e_cs = 0;
    public e_lfarlc = 0;
    public e_ovno = 0;
    public e_res = "";
    public e_oemid = 0;
    public e_oeminfo = 0;
    public e_res2 = "";
    public e_lfanew = 0;

    constructor(fileOffset: number) {
        super(FORMAT, fileOffset);
    }
}
